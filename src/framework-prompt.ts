import { getFramework } from "./frameworks.js";
import { depthOfFieldCharacter, opticsToProse } from "./optics.js";
import { ShotSchema, type Shot } from "./schemas.js";
import { A_ROLL_CONTRACT_DEFAULTS } from "./a-roll.js";

export interface FrameworkPromptContext {
  aspectRatio?: string;
  audience?: string;
  compactSurface?: boolean;
  contentFormat?: string;
  dramaticQuestion?: string;
  globalExclusions?: readonly string[];
  globalStyle?: readonly string[];
  productionTitle?: string;
  providerTarget?: string;
  scenePurpose?: string;
  sceneTitle?: string;
  shotCount?: number;
  shotIndex?: number;
  storyLogline?: string;
}

export interface FrameworkPromptResult {
  architecture: readonly string[];
  frameworkId: string;
  frameworkName: string;
  prompt: string;
}

const mandatoryExclusions = [
  "no identity drift",
  "no geometry morphing",
  "no unplanned logos",
] as const;

const sentence = (value: string): string => {
  const trimmed = value.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : trimmed + ".";
};

const sentenceStart = (value: string): string => {
  const complete = sentence(value);
  return complete.charAt(0).toUpperCase() + complete.slice(1);
};

const compactList = (values: readonly string[]): string => values.join("; ");

const unique = (values: readonly string[]): string[] => [...new Set(
  values.map((value) => value.trim()).filter(Boolean),
)];

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const withoutDuplicateDialogue = (value: string, spokenText?: string): string => {
  if (!spokenText) return value;
  const withoutTerminalPunctuation = spokenText.replace(/[.!?]+$/, "");
  const variants = unique([
    spokenText,
    ...(withoutTerminalPunctuation.includes(" ") || withoutTerminalPunctuation.length >= 8
      ? [withoutTerminalPunctuation]
      : []),
  ]).sort((left, right) => right.length - left.length);
  return variants.reduce((current, variant) => (
    current.replace(new RegExp(escapeRegExp(variant), "gi"), "the approved line")
  ), value);
};

const withoutDuplicateDialogueInTree = <T>(value: T, spokenText?: string): T => {
  if (typeof value === "string") return withoutDuplicateDialogue(value, spokenText) as T;
  if (Array.isArray(value)) {
    return value.map((item) => withoutDuplicateDialogueInTree(item, spokenText)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => (
      [key, withoutDuplicateDialogueInTree(item, spokenText)]
    ))) as T;
  }
  return value;
};

const spokenTextFor = (shot: Shot): string | undefined => (
  shot.dialogue ?? shot.audioTrack.spokenText
)?.trim();

const timedBeats = (shot: Shot): string => shot.beats
  .map((beat) => "[" + beat.startSeconds + "-" + beat.endSeconds + "s] "
    + withoutDuplicateDialogue(beat.action, spokenTextFor(shot)))
  .join("\n");

const temporalBoundaryRule = (): string => (
  "Temporal boundary rule: each beat begins only at its declared start time; no later action, dialogue, or terminal state may appear early."
);

const millisecondBeats = (shot: Shot): string => shot.beats
  .map((beat) => Math.round(beat.startSeconds * 1000) + "-" + Math.round(beat.endSeconds * 1000)
    + "ms: " + withoutDuplicateDialogue(beat.action, spokenTextFor(shot)))
  .join("\n");

const finalBeat = (shot: Shot): string => withoutDuplicateDialogue(
  shot.beats.at(-1)?.action ?? shot.action,
  spokenTextFor(shot),
);

const contextValue = (value: string | undefined, fallback: string): string => value?.trim() || fallback;

const allExclusions = (shot: Shot, context: FrameworkPromptContext): string[] => unique([
  ...(context.globalExclusions ?? []),
  ...shot.exclusions,
  ...mandatoryExclusions,
]);

const audioContract = (shot: Shot): string => {
  const spokenText = spokenTextFor(shot);
  const spokenWindow = shot.audioTrack.spokenWindow;
  const parts = [
    spokenText
      ? "The visible speaker says exactly once, \"" + spokenText
        + "\" with restrained, intelligible, lip-synchronized delivery. Dialogue exists only as production audio; preserve a clean live-action picture plate. No paraphrase, repetition, or substitute words."
      : null,
    spokenText && spokenWindow
      ? "Speech timing is locked to " + spokenWindow.startSeconds + "-" + spokenWindow.endSeconds
        + "s: do not begin articulation before " + spokenWindow.startSeconds + "s, and complete the line by "
        + spokenWindow.endSeconds + "s. Keep the mouth naturally closed before the cue."
      : null,
    shot.audioTrack.soundDesignDirectives.length
      ? "Synchronized sound design: " + compactList(shot.audioTrack.soundDesignDirectives) + "."
      : null,
    shot.audioTrack.musicDirective
      ? "Music boundary: " + sentence(shot.audioTrack.musicDirective)
      : "Music boundary: no score unless the shot contract explicitly requests it.",
    "Acoustic space follows the physical environment; transients occur only at their visible causes.",
  ].filter((part): part is string => Boolean(part));
  return parts.join(" ");
};

const imageBehavior = (shot: Shot, context: FrameworkPromptContext): string => {
  const grade = [
    ...(context.globalStyle ?? []),
    shot.lighting.isDesaturated ? "controlled desaturation" : "retain natural color separation",
    shot.lighting.isCrushedBlacks ? "intentional crushed blacks" : "protected shadow detail",
  ];
  const imperfections = shot.imperfectionAnchors.length
    ? "Visible imperfection anchors: " + compactList(shot.imperfectionAnchors) + "."
    : "Preserve physically plausible surface variation; do not beautify materials into smooth CGI.";
  const surfaceControl = shot.generationRisks.includes("BRAND_OR_TEXT_CONTROL")
    ? " Production design lock: declared clean surfaces remain uninterrupted base material, color, finish, and geometry from first frame to final frame."
    : "";
  return "Image behavior: " + compactList(unique(grade))
    + "; natural action-matched motion blur; restrained highlight roll-off. " + imperfections + surfaceControl;
};

const realityAnchor = (shot: Shot): string => [
  "Location and atmosphere: " + sentence(shot.environment),
  "Subject hard specification: " + sentence(shot.subject),
  shot.materials.length ? "Materials and surfaces: " + compactList(shot.materials) + "." : null,
  "Physical behavior: " + compactList(shot.physics) + ".",
  "Continuity boundary: " + compactList(shot.continuityLocks) + ".",
].filter((part): part is string => Boolean(part)).join("\n");

const captureContract = (shot: Shot): string | null => {
  const capture = shot.camera.capture;
  const parts = [
    capture.sensorFormat ? "sensor " + capture.sensorFormat : null,
    capture.recordingFormat ? "recording " + capture.recordingFormat : null,
    capture.rig ? "rig " + capture.rig : null,
    capture.frameRateFps ? capture.frameRateFps + "fps" : null,
    capture.shutterAngleDegrees ? capture.shutterAngleDegrees + "-degree shutter" : null,
    capture.resolutionIntent ? "finish " + capture.resolutionIntent : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length ? "Capture: " + compactList(parts) + "." : null;
};

const cameraContract = (shot: Shot): string => [
  opticsToProse(shot.camera.optics),
  captureContract(shot),
  "Shot language: " + shot.camera.shotType + ".",
  "Composition: " + sentence(shot.camera.framing),
  "Movement: " + sentence(shot.camera.movement),
  "Focus: " + sentence(shot.camera.focusBehavior),
  "Cadence: real-time motion with action-matched blur; no unrequested slow motion or speed ramp.",
].filter((part): part is string => Boolean(part)).join(" ");

const expression = (shot: Shot, context: FrameworkPromptContext, exclusions: readonly string[]): string => [
  "Lighting: " + shot.lighting.primarySource + ", motivated by " + shot.lighting.motivation + ".",
  "Color and grade: " + compactList(shot.lighting.paletteBase) + ".",
  imageBehavior(shot, context),
  "AUDIO CONTRACT: " + audioContract(shot),
  "DO NOT RENDER: " + compactList(exclusions) + ".",
].join("\n");

const compileCinematicProse = (
  shot: Shot,
  context: FrameworkPromptContext,
  exclusions: readonly string[],
): string => {
  const spokenText = spokenTextFor(shot);
  const action = withoutDuplicateDialogue(shot.action, spokenText);
  return [
    "TITLE:\n" + shot.title,
    "PREMISE:\nA single impossible-but-believable cinematic shot built around " + sentence(shot.subject)
      + " Dominant visible action: " + sentenceStart(action) + " Story purpose: " + sentence(shot.intent),
    "REALITY ANCHOR:\n" + realityAnchor(shot),
    "OPTICS AND CAMERA:\n" + cameraContract(shot) + " Format: " + shot.durationSeconds + " seconds, "
      + contextValue(context.aspectRatio, "aspect ratio set at provider handoff") + ".",
    "SEQUENCE:\n" + timedBeats(shot) + "\n" + temporalBoundaryRule()
      + "\nEND FRAME: " + sentence(finalBeat(shot)),
    "EXPRESSION AND EXCLUSIONS:\n" + expression(shot, context, exclusions),
  ].join("\n\n");
};

const sequencePhase = (context: FrameworkPromptContext): string => {
  const count = context.shotCount ?? 1;
  const index = context.shotIndex ?? 0;
  if (count <= 1) return "COMPLETE BEAT";
  if (index === 0) return "ESTABLISH";
  if (index === count - 1) return "PAYOFF";
  return "ESCALATE";
};

const compileActShotMaster = (
  shot: Shot,
  context: FrameworkPromptContext,
  exclusions: readonly string[],
): string => {
  const spokenText = spokenTextFor(shot);
  const action = withoutDuplicateDialogue(shot.action, spokenText);
  const shotNumber = (context.shotIndex ?? 0) + 1;
  const shotCount = context.shotCount ?? 1;
  return [
    "CORE VISUAL CONCEPT:\n" + sentence(contextValue(context.storyLogline, shot.intent))
      + " Dramatic question: " + sentence(contextValue(context.dramaticQuestion, shot.intent)),
    "THEMES:\nAudience: " + contextValue(context.audience, "defined by the production brief") + ". "
      + "Visual language: " + compactList(context.globalStyle ?? []) + ". Repeated continuity motif: "
      + compactList(shot.continuityLocks) + ".",
    "TECHNICAL MASTER SPECIFICATIONS:\nProduction: "
      + contextValue(context.productionTitle, shot.title) + ". Sequence position: shot " + shotNumber + " of "
      + shotCount + ". Duration: " + shot.durationSeconds + " seconds. Aspect ratio: "
      + contextValue(context.aspectRatio, "set at provider handoff") + ". " + cameraContract(shot)
      + " Color profile: " + compactList(shot.lighting.paletteBase) + ".",
    "ACT / SHOT - " + sequencePhase(context) + ":\nPurpose: " + sentence(shot.intent)
      + "\nShot " + shotNumber + " (" + shot.durationSeconds + "s), " + shot.camera.shotType + ": "
      + sentence(action) + "\nTIMED BEATS:\n" + timedBeats(shot) + "\n" + temporalBoundaryRule()
      + "\nLighting and atmosphere: " + shot.lighting.primarySource + "; " + shot.lighting.motivation + ".",
    "CONTINUITY SPINE AND TRANSITION LOGIC:\n" + compactList(shot.continuityLocks)
      + ". The final composition is reached through the declared action and camera move, not a hidden coverage cut."
      + " End frame: " + sentence(finalBeat(shot)),
    "IMAGE SCIENCE AND AUDIO:\n" + imageBehavior(shot, context) + " AUDIO CONTRACT: " + audioContract(shot),
    "PAYOFF AND DO NOT RENDER:\nPayoff: " + sentence(finalBeat(shot))
      + "\nDO NOT RENDER: " + compactList(exclusions) + ".",
  ].join("\n\n");
};

const compileJsonSceneContract = (
  shot: Shot,
  context: FrameworkPromptContext,
  exclusions: readonly string[],
): string => {
  const spokenText = spokenTextFor(shot);
  const action = withoutDuplicateDialogue(shot.action, spokenText);
  const contract = {
    metadata: {
      title: shot.title,
      duration_seconds: shot.durationSeconds,
      aspect_ratio: context.aspectRatio ?? "UNKNOWN",
      target_surface: context.contentFormat ?? "UNKNOWN",
      target_provider: context.providerTarget ?? "UNKNOWN",
    },
    scene: {
      location_and_atmosphere: shot.environment,
      story_purpose: shot.intent,
      scene_title: context.sceneTitle ?? shot.sceneId,
      scene_purpose: context.scenePurpose ?? "UNKNOWN",
    },
    subject: {
      primary_subject: shot.subject,
      action,
      identity_and_continuity_locks: shot.continuityLocks,
      materials: shot.materials,
      allowed_generated_text: shot.onScreenText ?? "none",
    },
    camera: {
      shot_language: shot.camera.shotType,
      camera_body: shot.camera.optics.cameraBody ?? "UNKNOWN",
      lens_model: shot.camera.optics.lensModel ?? "UNKNOWN",
      focal_length_mm: shot.camera.optics.focalLengthMm,
      t_stop: shot.camera.optics.tStop,
      subject_distance_meters: shot.camera.optics.subjectDistanceMeters,
      depth_of_field: depthOfFieldCharacter(shot.camera.optics),
      movement: shot.camera.movement,
      composition: shot.camera.framing,
      focus: shot.camera.focusBehavior,
      capture: shot.camera.capture,
    },
    lighting: {
      primary_source: shot.lighting.primarySource,
      motivation: shot.lighting.motivation,
      palette: shot.lighting.paletteBase,
      desaturated: shot.lighting.isDesaturated,
      crushed_blacks: shot.lighting.isCrushedBlacks,
    },
    timeline: shot.beats.map((beat) => ({
      start_seconds: beat.startSeconds,
      end_seconds: beat.endSeconds,
      visible_action: beat.action,
      continuity: shot.continuityLocks,
    })),
    audio: {
      spoken_text: spokenText ?? null,
      sound_design: shot.audioTrack.soundDesignDirectives,
      music_boundary: shot.audioTrack.musicDirective ?? "no score unless explicitly requested",
      exact_once: Boolean(spokenText),
    },
    constraints: {
      physics_rules: shot.physics,
      realism_anchors: shot.imperfectionAnchors,
      temporal_boundary_rule: temporalBoundaryRule(),
      must_avoid: exclusions,
    },
    compiled_prompt: sentenceStart(shot.subject + " in " + shot.environment) + " " + sentenceStart(action)
      + " " + cameraContract(shot) + " End frame: " + sentence(finalBeat(shot)),
  };
  return JSON.stringify(contract, null, 2);
};

const compileAvatarARollJson = (
  inputShot: Shot,
  inputContext: FrameworkPromptContext,
  inputExclusions: readonly string[],
): string => {
  const spokenText = spokenTextFor(inputShot);
  const shot = withoutDuplicateDialogueInTree(inputShot, spokenText);
  const context = withoutDuplicateDialogueInTree(inputContext, spokenText);
  const exclusions = inputExclusions.map((value) => withoutDuplicateDialogue(value, spokenText));
  const spokenWindow = shot.audioTrack.spokenWindow;
  const performerRef = shot.characterIds[0] ?? "PRIMARY_SPEAKER";
  const performance = shot.performance;
  const frameRateFps = shot.camera.capture.frameRateFps ?? A_ROLL_CONTRACT_DEFAULTS.frameRateFps;
  const freezePadFramesAtEnd = performance.freezePadFramesAtEnd
    ?? A_ROLL_CONTRACT_DEFAULTS.freezePadFramesAtEnd;
  const lipSyncConfidenceMin = shot.audioTrack.lipSyncConfidenceMin
    ?? A_ROLL_CONTRACT_DEFAULTS.lipSyncConfidenceMin;
  const terminalSettleProtocol = {
    speech_end_deadline_seconds: spokenWindow?.endSeconds ?? null,
    settle_window_seconds: spokenWindow
      ? [spokenWindow.endSeconds, shot.durationSeconds]
      : null,
    minimum_settle_seconds: A_ROLL_CONTRACT_DEFAULTS.minimumTerminalSettleSeconds,
    final_freeze_frames: freezePadFramesAtEnd,
    state: "after the final phoneme, seal the lips once; keep them gently sealed with a relaxed jaw and naturally open eyes through the final frame",
    forbidden_after_final_phoneme: [
      "mouth reopening or silent mouthing",
      "jaw reset, added breath articulation, or a new expression",
      "blink, eye roll, gesture, head bob, or pose change during the final freeze",
    ],
  };
  if (context.compactSurface) {
    const compactContract = {
      project_manifest: {
        manifest_version: "AUTEUR A-Roll JSON 1.0",
        global_creative_directive: {
          format: "A-Roll",
          fidelity: "photoreal speech, skin, optics",
          duration_seconds: shot.durationSeconds,
          aspect_ratio: context.aspectRatio ?? "UNKNOWN",
          frame_rate_fps: frameRateFps,
          freeze_pad_frames_at_end: freezePadFramesAtEnd,
        },
        character_asset_bible: {
          speaker: {
            ref_id: performerRef,
            reference: "attached",
            identity_lock: shot.continuityLocks,
          },
          vocal_lock: {
            profile: shot.audioTrack.voiceProfileId ?? "REFERENCE_AUDIO_IF_SUPPLIED",
            language: shot.audioTrack.language ?? "English",
            pace_wpm: shot.audioTrack.paceWpm ?? "NATURAL_FOR_WINDOW",
            delivery: shot.audioTrack.deliveryStyle ?? performance.deliveryStyle ?? "restrained direct conversation",
            immutable: true,
          },
        },
        scene_blueprint: {
          narrative_beat: shot.intent,
          performance_manifest: {
            posture: performance.basePosture ?? "reference posture; grounded breathing",
            eye_line: performance.eyeLine ?? "near lens; no scanning",
            facial_constraints: {
              jaw_mm: performance.jawMovementMaxDeviationMm ?? 4,
              lip_style: performance.lipArticulationStyle ?? "economical natural movement",
              head_degrees: performance.headMovementMaxDegrees ?? 2,
              expression_source: performance.emotionalExpressionSource ?? "eyes/brows; restrained mouth",
            },
            terminal_settle_protocol: terminalSettleProtocol,
            timeline: shot.beats.map((beat) => ({
              seconds: [beat.startSeconds, beat.endSeconds],
              action: withoutDuplicateDialogue(beat.action, spokenText),
            })),
          },
          cinematography_optics_psychology: {
            shot_type: shot.camera.shotType.toLowerCase().includes("a-roll")
              ? shot.camera.shotType
              : "A-Roll: " + shot.camera.shotType,
            camera: shot.camera.optics.cameraBody ?? "cinema camera",
            lens: shot.camera.optics.lensModel ?? "portrait prime",
            focal_length_mm: shot.camera.optics.focalLengthMm,
            t_stop: shot.camera.optics.tStop,
            subject_distance_m: shot.camera.optics.subjectDistanceMeters,
            movement: shot.camera.movement,
            framing: shot.camera.framing,
            focus: shot.camera.focusBehavior,
          },
          environment_photometry: {
            environment: shot.environment,
            key: shot.lighting.primarySource,
            motivation: shot.lighting.motivation,
            palette: shot.lighting.paletteBase,
            materials: shot.materials,
            realism_anchors: shot.imperfectionAnchors,
          },
          audio_vocal_lock: {
            verbatim_script: spokenText ?? null,
            exact_once: Boolean(spokenText),
            spoken_window_seconds: spokenWindow
              ? [spokenWindow.startSeconds, spokenWindow.endSeconds]
              : [0, shot.durationSeconds],
            phoneme_acceptance_ms: shot.audioTrack.phonemeToleranceMs ?? 20,
            lip_sync_confidence_min: lipSyncConfidenceMin,
            sound: shot.audioTrack.soundDesignDirectives,
            music: shot.audioTrack.musicDirective ?? "no score",
          },
        },
        triple_lock_protocol: {
          script: "exact once; no rewrite/repeat/subtitle/early speech",
          identity: "lock face, wardrobe, anatomy, eye line, voice",
          temporal: "one take; no early beat; after the final phoneme lips remain sealed continuously through the "
            + freezePadFramesAtEnd + "-frame end",
        },
        constraints: {
          physics: shot.physics,
          negative_exclusions: exclusions,
        },
        acceptance_tests: [
          "script exact once",
          "sync target",
          "identity/camera/set stable",
          "natural motion",
          "no post-speech mouth reopening; " + freezePadFramesAtEnd + "-frame closed-lip handoff",
        ],
      },
    };
    return JSON.stringify(compactContract, null, 2);
  }
  const contract = {
    project_manifest: {
      manifest_version: "AUTEUR A-Roll JSON 1.0",
      project_title: contextValue(context.productionTitle, shot.title),
      evidence_class: "PROMPT_CORPUS",
      layer_0_intent_and_provenance: {
        narrative_beat: shot.intent,
        execution_target: "one credible uninterrupted A-roll performance from the supplied speaker reference",
      },
      layer_i_global_creative_directive: {
        fidelity_mandate: "Strict photographic realism with natural skin, articulation, breath, weight, and optical behavior; reject uncanny or presenter-like motion.",
        aesthetic_dna: {
          format: "A-Roll",
          qualities: unique([...(context.globalStyle ?? []), "restrained human performance", "clean live-action plate"]),
        },
        render_specifications: {
          duration_seconds: shot.durationSeconds,
          aspect_ratio: context.aspectRatio ?? "UNKNOWN",
          frame_rate_fps: frameRateFps,
          freeze_pad_frames_at_end: freezePadFramesAtEnd,
        },
      },
      layer_iii_character_and_asset_bible: {
        character_consistency: {
          PRIMARY_SPEAKER: {
            ref_id: performerRef,
            reference_source: "attached or declared speaker identity asset",
            identity_and_wardrobe_lock: shot.continuityLocks,
          },
        },
        vocal_signature_lock: {
          voice_profile_id: shot.audioTrack.voiceProfileId ?? "REFERENCE_AUDIO_IF_SUPPLIED",
          language: shot.audioTrack.language ?? "English",
          pace_wpm: shot.audioTrack.paceWpm ?? "NATURAL_FOR_SCRIPT_WINDOW",
          delivery: shot.audioTrack.deliveryStyle ?? performance.deliveryStyle ?? "restrained, direct, conversational",
          immutable_across_sequence: true,
        },
      },
      layer_iv_scene_blueprint: {
        scene_title: context.sceneTitle ?? shot.sceneId,
        narrative_beat: shot.intent,
        time_block_seconds: [0, shot.durationSeconds],
        keyframe_directives: {
          "1_subjects_kinetics_and_phenomenology": {
            subjects: [{ ref_id: "PRIMARY_SPEAKER" }],
            performance_manifest: {
              base_posture: performance.basePosture ?? "preserve the supplied reference posture with grounded breathing",
              eye_line: performance.eyeLine ?? "stable near-lens attention without teleprompter scanning",
              facial_constraints: {
                jaw_movement_max_deviation_mm: performance.jawMovementMaxDeviationMm ?? 4,
                lip_articulation_style: performance.lipArticulationStyle ?? "economical natural movement",
                head_movement_max_degrees: performance.headMovementMaxDegrees ?? 2,
                emotional_expression_source: performance.emotionalExpressionSource ?? "eyes and brows with restrained mouth movement",
              },
              terminal_hold: {
                ...terminalSettleProtocol,
              },
              timeline: shot.beats.map((beat) => ({
                time_range_seconds: [beat.startSeconds, beat.endSeconds],
                action: withoutDuplicateDialogue(beat.action, spokenText),
              })),
            },
          },
          "2_cinematography_optics_and_psychology": {
            shot_type: shot.camera.shotType.toLowerCase().includes("a-roll")
              ? shot.camera.shotType
              : "A-Roll: " + shot.camera.shotType,
            psychological_framing: shot.intent,
            lens: {
              camera_body: shot.camera.optics.cameraBody ?? "cinema camera",
              lens_model: shot.camera.optics.lensModel ?? "portrait prime",
              focal_length_mm: shot.camera.optics.focalLengthMm,
              aperture_t_stop: shot.camera.optics.tStop,
              subject_distance_meters: shot.camera.optics.subjectDistanceMeters,
            },
            camera_movement: shot.camera.movement,
            composition: shot.camera.framing,
            focus: shot.camera.focusBehavior,
          },
          "3_environment_photometry_and_atmosphere": {
            environment: shot.environment,
            lighting: {
              primary_source: shot.lighting.primarySource,
              motivation: shot.lighting.motivation,
              palette: shot.lighting.paletteBase,
            },
            materials: shot.materials,
            realism_anchors: shot.imperfectionAnchors,
          },
          "4_audio_and_sensory_sync": {
            locked_audio_profile: {
              verbatim: Boolean(spokenText),
              script_for_timing: spokenText ?? null,
              spoken_window_seconds: spokenWindow
                ? [spokenWindow.startSeconds, spokenWindow.endSeconds]
                : [0, shot.durationSeconds],
              phoneme_alignment: {
                mode: "strict",
                acceptance_target_ms: shot.audioTrack.phonemeToleranceMs ?? 20,
                confidence_min: lipSyncConfidenceMin,
              },
              mix: shot.audioTrack.mix ?? { stereoWidth: "neutral_centered" },
            },
            sound_design: shot.audioTrack.soundDesignDirectives,
            music_boundary: shot.audioTrack.musicDirective ?? "no score",
          },
        },
      },
      layer_vi_ai_model_constraints: {
        triple_lock_protocol: {
          script_lock: {
            rule: "verbatim once; no paraphrase, repetition, subtitle, or early articulation",
            timing: spokenWindow
              ? "do not begin articulation before " + spokenWindow.startSeconds + "s; complete by "
                + spokenWindow.endSeconds + "s"
              : "complete naturally inside the declared shot window",
          },
          identity_lock: "preserve the supplied face, wardrobe, anatomy, eye line, and voice signature",
          temporal_lock: "single continuous take; " + temporalBoundaryRule() + " Final "
            + freezePadFramesAtEnd + " frames hold continuously sealed lips, relaxed jaw, naturally open eyes, stable eye line, and no new action. Once the final phoneme ends, never reopen or silently move the mouth.",
        },
        physics_rules: shot.physics,
        negative_exclusions: exclusions,
        acceptance_tests: [
          "dialogue transcript matches the approved script word for word exactly once",
          "visible articulation aligns to the accepted audio within the declared target tolerance",
          "speaker identity, wardrobe, camera, background, light, and microphone geometry remain stable",
          "performance retains natural blinks, micro-saccades, breath, facial asymmetry, and restrained head motion",
          "after the final phoneme the mouth never reopens; final " + freezePadFramesAtEnd
            + " frames form a clean closed-lip, open-eyed handoff with no new action",
        ],
      },
    },
  };
  return JSON.stringify(contract, null, 2);
};

const compileTemporalEvolution = (
  shot: Shot,
  context: FrameworkPromptContext,
  exclusions: readonly string[],
): string => {
  const spokenText = spokenTextFor(shot);
  const action = withoutDuplicateDialogue(shot.action, spokenText);
  const first = shot.beats[0]?.action ?? action;
  return [
    "TRANSFORMATION GOAL:\n" + sentence(action) + " The clip succeeds only through visible cause and effect while preserving "
      + compactList(shot.continuityLocks) + ".",
    "INITIAL STATE (0.0s):\nSubject and visible state: " + sentence(shot.subject + "; " + first)
      + "\nMaterial and scale: " + compactList(shot.materials) + ".\nEnvironment: " + sentence(shot.environment)
      + "\nCamera and lighting at frame zero: " + cameraContract(shot) + " " + shot.lighting.primarySource
      + ", motivated by " + shot.lighting.motivation + ".",
    "FINAL STATE (END FRAME):\nThe clip succeeds only if " + sentence(finalBeat(shot))
      + " The final composition retains the same identity, scale, material family, camera logic, and light direction.",
    "IMMUTABLE CONTINUITY KEYS:\n- Identity and geometry: " + compactList(shot.continuityLocks)
      + ".\n- Camera: " + shot.camera.movement + "; " + shot.camera.framing + ".\n- Lighting direction: "
      + shot.lighting.primarySource + ".\n- Color and material: " + compactList(shot.lighting.paletteBase)
      + "; " + compactList(shot.materials) + ".",
    "PHASE PLAN:\n" + timedBeats(shot) + "\n" + temporalBoundaryRule(),
    "PHYSICS AND TEMPORAL RULES:\n" + compactList(shot.physics)
      + ". Each phase begins from the visible result of the previous phase; no reset, teleport, or unexplained substitution. "
      + imageBehavior(shot, context),
    "AUDIO CONTRACT:\n" + audioContract(shot),
    "FAIL-CLOSED NEGATIVES:\n" + compactList(exclusions) + ".",
  ].join("\n\n");
};

const compileTimedSocialSequence = (
  shot: Shot,
  context: FrameworkPromptContext,
  exclusions: readonly string[],
): string => {
  const first = shot.beats[0]?.action ?? shot.action;
  return [
    "PLATFORM AND GOAL:\nFormat: " + contextValue(context.contentFormat, "short-form video")
      + ". Audience: " + contextValue(context.audience, "defined by the production brief")
      + ". Desired response: " + sentence(shot.intent) + " Aspect ratio and duration: "
      + contextValue(context.aspectRatio, "set at provider handoff") + ", " + shot.durationSeconds + " seconds.",
    "HOOK (FIRST 2 SECONDS):\nVisual hook: " + sentence(first)
      + " Text rule: " + (shot.onScreenText
        ? "reserve clean space for exact post-composited copy; do not generate lettering"
        : "no generated text; add copy in post if needed") + ".",
    "BEAT TIMELINE:\n" + timedBeats(shot) + "\n" + temporalBoundaryRule(),
    "VISUAL LANGUAGE:\nSubject: " + sentence(shot.subject) + " Environment: " + sentence(shot.environment)
      + " Camera: " + cameraContract(shot) + " Lighting and color: " + shot.lighting.primarySource + "; "
      + compactList(shot.lighting.paletteBase) + ".",
    "RETENTION, SHARE TRIGGER, AND PAYOFF:\nPattern progression: each timed beat must add new visible information. "
      + "Share trigger: " + sentence(shot.intent) + " End on: " + sentence(finalBeat(shot)),
    "AUDIO AND EDITING:\n" + audioContract(shot) + " One rhythmic visual progression; no chaotic coverage or dead beat. "
      + imageBehavior(shot, context),
    "NEGATIVES:\n" + compactList(exclusions) + ".",
  ].join("\n\n");
};

const compilePracticalStunt = (
  shot: Shot,
  context: FrameworkPromptContext,
  exclusions: readonly string[],
): string => {
  const spokenText = spokenTextFor(shot);
  const action = withoutDuplicateDialogue(shot.action, spokenText);
  return [
    "CORE CONCEPT:\nAn " + shot.durationSeconds + "-second practical live-action plate built around "
      + sentence(shot.subject) + " Dominant visible action: " + sentenceStart(action)
      + " Emotional arc: " + sentence(shot.intent),
    "ACQUISITION STACK:\n" + cameraContract(shot) + " Aspect ratio: "
      + contextValue(context.aspectRatio, "set at provider handoff")
      + ". One physically traceable camera path; no hidden coverage cut.",
    "REALITY ANCHOR:\n" + realityAnchor(shot),
    "CONTINUOUS CAMERA MOVE (" + Math.round(shot.durationSeconds * 1000) + "ms):\n" + millisecondBeats(shot)
      + "\n" + temporalBoundaryRule(),
    "CONTACT, MASS, AND MOMENTUM RULES:\n" + compactList(shot.physics)
      + ". Every reaction begins at visible contact; bodies and objects retain mass, inertia, friction, balance, and recovery time."
      + " No impact without contact and no contact without a physically propagated result.",
    "CRITICAL IMAGE SCIENCE:\n" + imageBehavior(shot, context)
      + " Preserve operator-scale micro-instability and action-matched motion blur; reject frictionless or polished CGI movement.",
    "SYNCHRONIZED AUDIO LANDSCAPE:\n" + audioContract(shot),
    "HARD EXCLUSIONS - DO NOT RENDER:\n" + compactList(exclusions) + ".",
  ].join("\n\n");
};

const compileContinuousTake = (
  shot: Shot,
  context: FrameworkPromptContext,
  exclusions: readonly string[],
): string => {
  const spokenText = spokenTextFor(shot);
  const action = withoutDuplicateDialogue(shot.action, spokenText);
  const beats = shot.beats.map((beat, index) => {
    const prefix = index === 0 ? "It begins" : index === shot.beats.length - 1 ? "It ends" : "It continues";
    return prefix + " at " + beat.startSeconds + "-" + beat.endSeconds + "s with "
      + withoutDuplicateDialogue(beat.action, spokenText) + ".";
  }).join(" ");
  return [
    "A single unbroken " + shot.durationSeconds + "-second take, with no cut, transition, temporal reset, or coverage jump. "
      + sentenceStart(shot.subject + " in " + shot.environment) + " " + sentenceStart(action)
      + " Identity and continuity remain locked: " + compactList(shot.continuityLocks) + ".",
    cameraContract(shot) + " The camera relationship stays physically continuous from the first frame to the last; every new composition is reached through the declared move.",
    beats + " " + temporalBoundaryRule() + " The exact end-frame success condition is: " + sentence(finalBeat(shot)),
    "Lighting is " + shot.lighting.primarySource + ", motivated by " + shot.lighting.motivation + "; palette "
      + compactList(shot.lighting.paletteBase) + ". Materials remain " + compactList(shot.materials)
      + ". Physical behavior: " + compactList(shot.physics) + ". " + imageBehavior(shot, context),
    "AUDIO CONTRACT: " + audioContract(shot),
    "DO NOT RENDER: " + compactList(exclusions) + ".",
  ].join(" ");
};

const compileAudioFramework = (
  shot: Shot,
  context: FrameworkPromptContext,
  exclusions: readonly string[],
): string => {
  const spokenText = spokenTextFor(shot);
  const action = withoutDuplicateDialogue(shot.action, spokenText);
  return [
    "PRIMARY SOURCE AND PERFORMANCE:\n" + audioContract(shot),
    "VISIBLE SYNC MAP:\n" + timedBeats(shot) + "\n" + temporalBoundaryRule(),
    "SECONDARY AMBIENCE AND ACOUSTIC SPACE:\nEnvironment: " + sentence(shot.environment)
      + " Reflections, distance, reverb, and occlusion must follow the visible space and camera distance.",
    "MIX HIERARCHY:\nExact speech, when present, stays intelligible in the foreground. Causal transients follow visible actions. "
      + "Environmental bed supports rather than masks the primary source. Avoid generic trailer impacts unless explicitly requested.",
    "VISUAL REFERENCE FOR SYNC:\n" + sentence(shot.subject + " " + action) + " " + cameraContract(shot)
      + " " + imageBehavior(shot, context),
    "AUDIO EXCLUSIONS:\nNo unrelated score, no unsynchronized transient, no repeated or paraphrased dialogue. Keep dialogue in the sound track and preserve a clean picture plate. "
      + compactList(exclusions) + ".",
  ].join("\n\n");
};

export function compileFrameworkVideoPrompt(
  input: Shot,
  context: FrameworkPromptContext = {},
): FrameworkPromptResult {
  const shot = ShotSchema.parse(input);
  const framework = getFramework(shot.frameworkId);
  const exclusions = allExclusions(shot, context);

  let prompt: string;
  switch (framework.id) {
    case "cinematic-prose-stack":
      prompt = compileCinematicProse(shot, context, exclusions);
      break;
    case "act-shot-master-spec":
      prompt = compileActShotMaster(shot, context, exclusions);
      break;
    case "json-scene-contract":
      prompt = compileJsonSceneContract(shot, context, exclusions);
      break;
    case "avatar-a-roll-json":
      prompt = compileAvatarARollJson(shot, context, exclusions);
      break;
    case "temporal-evolution":
      prompt = compileTemporalEvolution(shot, context, exclusions);
      break;
    case "timed-social-sequence":
      prompt = compileTimedSocialSequence(shot, context, exclusions);
      break;
    case "practical-stunt-contract":
      prompt = compilePracticalStunt(shot, context, exclusions);
      break;
    case "continuous-take":
      prompt = compileContinuousTake(shot, context, exclusions);
      break;
    case "audio-contract":
      prompt = compileAudioFramework(shot, context, exclusions);
      break;
    case "repair-pass":
      throw new Error(
        "Constrained Repair Pass requires an observed defect. ACTION: use buildRepairPrompt with the observed symptom and preserve list.",
      );
    case "render-observed-continuation":
      throw new Error(
        "Render-Observed Continuation requires actual final-frame evidence. ACTION: use compileContinuationPrompt with a ContinuationInput contract.",
      );
    default:
      throw new Error("No compiler is registered for framework: " + framework.id);
  }

  return {
    architecture: framework.requiredBlocks,
    frameworkId: framework.id,
    frameworkName: framework.name,
    prompt,
  };
}
