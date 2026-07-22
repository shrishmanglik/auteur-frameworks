import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FRAMEWORKS,
  ContentFormatSchema,
  UniversalPacketSchema,
  assessShotRoute,
  buildRepairPrompt,
  buildStoryboard,
  buildDevelopmentContract,
  compilePacket,
  compileCompactVideoPrompt,
  compileCompactVideoPromptWithReport,
  compileShot,
  depthOfFieldCharacter,
  preflightPacket,
} from "../src/index.js";

const example = JSON.parse(fs.readFileSync(new URL("../examples/product-film.json", import.meta.url), "utf8"));

describe("universal packet", () => {
  it("parses the synthetic product-film example", () => {
    const packet = UniversalPacketSchema.parse(example);
    expect(packet.shots).toHaveLength(1);
    expect(packet.shots[0]?.camera.capture).toEqual({});
  });

  it("ships a distinct provider-neutral framework registry", () => {
    expect(FRAMEWORKS.length).toBeGreaterThanOrEqual(9);
    expect(new Set(FRAMEWORKS.map((item) => item.id)).size).toBe(FRAMEWORKS.length);
  });

  it("keeps published JSON schemas aligned with spoken timing windows", () => {
    for (const filename of ["universal-packet.schema.json", "continuation-input.schema.json"]) {
      const schema = fs.readFileSync(new URL(`../schemas/${filename}`, import.meta.url), "utf8");
      expect(schema, filename).toContain('"spokenWindow"');
      expect(schema, filename).toContain('"additionalProperties": false');
    }
  });

  it("keeps defaulted performance controls optional in published input schemas", () => {
    const universal = JSON.parse(fs.readFileSync(
      new URL("../schemas/universal-packet.schema.json", import.meta.url),
      "utf8",
    ));
    const continuation = JSON.parse(fs.readFileSync(
      new URL("../schemas/continuation-input.schema.json", import.meta.url),
      "utf8",
    ));

    expect(universal.properties.shots.items.properties.performance).toBeTypeOf("object");
    expect(universal.properties.shots.items.required).not.toContain("performance");
    expect(continuation.properties.shot.properties.performance).toBeTypeOf("object");
    expect(continuation.properties.shot.required).not.toContain("performance");
    expect(UniversalPacketSchema.parse(example).shots[0]?.performance).toEqual({});
  });
});

describe("development contract", () => {
  it("routes a raw short-film idea into a schema-bound act/shot contract", () => {
    const contract = buildDevelopmentContract({
      idea: "A night-shift cleaner finds one office elevator stopping at a floor that does not exist.",
      format: "short-film",
      targetDurationSeconds: 90,
      aspectRatio: "2.39:1",
      audience: "adult suspense viewers",
      tone: ["dry", "uneasy", "human"],
      constraints: ["one actor", "one location"],
      hasDialogue: true,
      requiresTransformation: false,
      audioRequired: true,
    });
    expect(contract.framework.id).toBe("act-shot-master-spec");
    expect(contract.systemInstruction).toContain("Return only data");
    expect(contract.responseSchema).toBeTypeOf("object");
  });

  it("routes transformation work to temporal evolution", () => {
    const contract = buildDevelopmentContract({
      idea: "A paper city folds itself into a working mechanical clock in one unbroken view.",
      format: "vfx",
      targetDurationSeconds: 12,
      aspectRatio: "16:9",
      audience: "design and motion audiences",
      tone: ["precise", "tactile"],
      requiresTransformation: true,
    });
    expect(contract.framework.id).toBe("temporal-evolution");
  });

  it("routes explicit production problems to their native framework architectures", () => {
    const base = {
      idea: "An original production problem with one observable action and a measurable final state.",
      format: "other" as const,
      targetDurationSeconds: 8,
      aspectRatio: "16:9" as const,
      audience: "professional filmmakers",
      tone: ["specific", "physical"],
    };
    expect(buildDevelopmentContract({ ...base, requiresPracticalChoreography: true }).framework.id)
      .toBe("practical-stunt-contract");
    expect(buildDevelopmentContract({ ...base, requiresMachineReadableSceneContract: true }).framework.id)
      .toBe("json-scene-contract");
    expect(buildDevelopmentContract({ ...base, audioFirst: true }).framework.id)
      .toBe("audio-contract");
  });

  it("builds a development contract for every public content format", () => {
    const expectedRoutes = {
      "short-film": "act-shot-master-spec",
      ad: "cinematic-prose-stack",
      reel: "timed-social-sequence",
      "a-roll": "avatar-a-roll-json",
      "b-roll": "cinematic-prose-stack",
      "music-video": "act-shot-master-spec",
      "product-film": "cinematic-prose-stack",
      "character-scene": "continuous-take",
      vfx: "temporal-evolution",
      animation: "cinematic-prose-stack",
      image: "cinematic-prose-stack",
      sequence: "act-shot-master-spec",
      other: "cinematic-prose-stack",
    } as const;
    for (const format of ContentFormatSchema.options) {
      const contract = buildDevelopmentContract({
        idea: `An original ${format} concept with one observable action and an earned final state.`,
        format,
        targetDurationSeconds: 24,
        aspectRatio: "16:9",
        audience: "general creative audience",
        tone: ["specific", "human"],
      });
      expect(contract.request.format).toBe(format);
      expect(contract.framework.id).toBe(expectedRoutes[format]);
      expect(contract.responseSchema).toBeTypeOf("object");
    }
  });
});

describe("compiler", () => {
  it("puts optics before movement and emits all generation surfaces", () => {
    const shot = UniversalPacketSchema.parse(example).shots[0]!;
    const compiled = compileShot(shot);
    expect(compiled.videoPrompt.indexOf("100mm")).toBeLessThan(compiled.videoPrompt.indexOf("slider"));
    expect(compiled.promptFidelity).toBe("FRAMEWORK_NATIVE");
    expect(compiled.frameworkName).toBe("Cinematic Prose Stack");
    expect(compiled.compactVideoPrompt).toContain("[0-2s]");
    expect(compiled.compactVideoPrompt).toContain("100mm");
    expect(compiled.compactVideoPrompt).toContain("PREMISE:");
    expect(compiled.compactVideoPrompt).toContain("REALITY ANCHOR:");
    expect(compiled.compactVideoPrompt).toContain("OPTICS AND CAMERA:");
    expect(compiled.compactVideoPrompt).toContain("SEQUENCE:");
    expect(compiled.compactVideoPrompt).toContain("EXPRESSION AND EXCLUSIONS:");
    expect(compiled.compactVideoPrompt).toContain("no identity drift");
    expect(compiled.compactPromptReport.frameworkPreserved).toBe(true);
    expect(compiled.frameStateSources.opening).toBe("minimal-fallback");
    expect(compiled.terminalFramePrompt).toContain("tiny trapped bubbles");
    expect(compiled.framePrompt).toContain("Reference surface lock:");
    expect(compiled.framePrompt).toContain("otherwise it remains plain and unbranded");
    expect(compiled.framePrompt).not.toContain("No glyph, letter, number");
    expect(compiled.audioPrompt).toContain("liquid pour");
    expect(compiled.negativePrompt).toContain("no identity drift");
  });

  it("separates opening and terminal frame contracts for multi-stage reference routes", () => {
    const shot = structuredClone(UniversalPacketSchema.parse(example).shots[0]!);
    shot.generationRisks = ["IDENTITY_OR_PERFORMANCE"];
    shot.subject = "one professional diver with one handheld lamp";
    shot.environment = "cold green water, broken timber ribs, and one bronze bell attached to a beam";
    shot.materials = ["waterlogged timber", "oxidized bronze", "black drysuit fabric"];
    shot.imperfectionAnchors = ["uneven silt", "biofouling on the bell edge"];
    shot.continuityLocks = ["same diver gear", "bell stays attached to the beam"];
    shot.beats = [
      { startSeconds: 0, endSeconds: 2, action: "the diver enters through a narrow timber gap" },
      { startSeconds: 2, endSeconds: 6, action: "the lamp sweeps once across waterlogged timber" },
      { startSeconds: 6, endSeconds: 8, action: "the lamp reveals the bronze bell and the diver stops" },
    ];
    shot.frameStates = {
      opening: {
        subject: "one professional diver with one handheld lamp",
        action: "the diver has just entered through a narrow timber gap",
        environment: "cold green water with suspended silt and occluding timber ribs",
        visibleInventory: ["one diver", "one right-hand lamp", "two plain tanks", "one timber gap"],
        lighting: "the handheld lamp rakes across near timber",
        paletteBase: ["cold green", "weathered timber", "black neoprene", "plain steel"],
        materials: ["waterlogged timber", "black drysuit fabric", "plain brushed metal tanks"],
        imperfectionAnchors: ["tiny scratches on mask glass", "uneven silt density"],
        continuityLocks: ["same diver gear and tank layout", "one lamp remains in the right hand"],
      },
      terminal: {
        subject: "the same professional diver with the same handheld lamp",
        action: "the lamp reveals the bronze bell and the diver stops",
        environment: "cold green water beside one bronze bell attached to a wreck beam",
        visibleInventory: ["one diver", "one right-hand lamp", "one attached bronze bell"],
        lighting: "the handheld lamp lands on the bronze bell",
        paletteBase: ["cold green", "aged bronze", "black neoprene"],
        materials: ["waterlogged timber", "oxidized bronze", "black drysuit fabric"],
        imperfectionAnchors: ["tiny scratches on mask glass", "biofouling on the bell edge"],
        continuityLocks: ["same diver gear and tank layout", "bell stays attached to the beam"],
      },
    };
    const compiled = compileShot(shot);
    const route = assessShotRoute(shot);

    expect(compiled.framePrompt).toBe(compiled.openingFramePrompt);
    expect(compiled.openingFramePrompt).toContain("OPENING STATE (0.0s):");
    expect(compiled.openingFramePrompt).toContain("the diver has just entered through a narrow timber gap");
    expect(compiled.openingFramePrompt).not.toMatch(/bell/i);
    expect(compiled.openingFramePrompt).not.toMatch(/bronze/i);
    expect(compiled.openingFramePrompt).toContain("assigned to a later beat remains outside frame");
    expect(compiled.terminalFramePrompt).toContain("TERMINAL STATE (8s):");
    expect(compiled.terminalFramePrompt).toContain("the lamp reveals the bronze bell");
    expect(compiled.terminalFramePrompt).toContain("Endpoint match lock:");
    expect(compiled.terminalFramePrompt).toContain("change only the declared terminal state");
    expect(compiled.frameStateSources).toEqual({ opening: "explicit", terminal: "explicit" });
    expect(route.recommendedMode).toBe("split-pass");
    expect(route.risks).toContainEqual(expect.objectContaining({ code: "DELAYED_TERMINAL_REVEAL" }));
    expect(route.requiredAssets).toContain("accepted pre-reveal final frame for render-observed continuation compilation");
    expect(route.acceptanceChecks).toContain("Reject a pre-reveal pass whose prompt or pixels expose terminal-only inventory.");
  });

  it("labels a safe minimal opening fallback instead of copying composite scene fields", () => {
    const shot = structuredClone(UniversalPacketSchema.parse(example).shots[0]!);
    shot.generationRisks = ["IDENTITY_OR_PERFORMANCE"];
    shot.environment = "a workshop where the final engraved trophy is already visible";
    shot.materials = ["engraved trophy metal"];
    shot.continuityLocks = ["trophy remains on the table", "same craftsperson identity"];
    const compiled = compileShot(shot);

    expect(compiled.frameStateSources.opening).toBe("minimal-fallback");
    expect(compiled.openingFramePrompt).not.toContain("final engraved trophy");
    expect(compiled.openingFramePrompt).not.toContain("trophy remains on the table");
    expect(compiled.qcIssues).toContainEqual(expect.objectContaining({ code: "OPENING_FRAME_STATE_FALLBACK" }));
  });

  it("compiles genuinely distinct corpus architectures instead of relabeling one template", () => {
    const baseShot = structuredClone(UniversalPacketSchema.parse(example).shots[0]!);
    const expectedSignatures = {
      "cinematic-prose-stack": "PREMISE:",
      "act-shot-master-spec": "TECHNICAL MASTER SPECIFICATIONS:",
      "json-scene-contract": "\"metadata\"",
      "avatar-a-roll-json": "\"project_manifest\"",
      "temporal-evolution": "INITIAL STATE (0.0s):",
      "timed-social-sequence": "HOOK (FIRST 2 SECONDS):",
      "practical-stunt-contract": "CONTINUOUS CAMERA MOVE (8000ms):",
      "continuous-take": "A single unbroken 8-second take",
      "audio-contract": "PRIMARY SOURCE AND PERFORMANCE:",
    } as const;
    const prompts = Object.entries(expectedSignatures).map(([frameworkId, signature]) => {
      const shot = structuredClone(baseShot);
      shot.frameworkId = frameworkId;
      if (frameworkId === "practical-stunt-contract") {
        shot.camera.capture = {
          sensorFormat: "Super 35 digital cinema sensor",
          recordingFormat: "log acquisition",
          rig: "low tracking vehicle rig",
          frameRateFps: 24,
          shutterAngleDegrees: 180,
          resolutionIntent: "4K finish",
        };
      }
      const compiled = compileShot(shot, example.globalExclusions, example.globalStyle, {
        aspectRatio: "16:9",
        audience: "filmmakers",
        contentFormat: "product-film",
        productionTitle: "Architecture fidelity test",
        shotCount: 1,
        shotIndex: 0,
      });
      expect(compiled.videoPrompt, frameworkId).toContain(signature);
      expect(compiled.videoPrompt, frameworkId).toContain("Temporal boundary rule:");
      expect(compiled.compactVideoPrompt, frameworkId).toContain(signature);
      expect(compiled.frameworkArchitecture.length, frameworkId).toBeGreaterThanOrEqual(5);
      expect(compiled.compactPromptReport.frameworkPreserved).toBe(true);
      if (frameworkId === "practical-stunt-contract") {
        expect(compiled.videoPrompt).toContain("24fps");
        expect(compiled.videoPrompt).toContain("180-degree shutter");
      }
      return compiled.videoPrompt;
    });
    expect(new Set(prompts).size).toBe(Object.keys(expectedSignatures).length);
  });

  it("fails closed when evidence-specific frameworks are used through the generic shot compiler", () => {
    const baseShot = structuredClone(UniversalPacketSchema.parse(example).shots[0]!);
    const repairShot = structuredClone(baseShot);
    repairShot.frameworkId = "repair-pass";
    expect(() => compileShot(repairShot)).toThrow("use buildRepairPrompt");

    const continuationShot = structuredClone(baseShot);
    continuationShot.frameworkId = "render-observed-continuation";
    expect(() => compileShot(continuationShot)).toThrow("use compileContinuationPrompt");
  });

  it("emits exact dialogue once even when action and beat text repeat it", () => {
    for (const frameworkId of ["avatar-a-roll-json", "continuous-take", "audio-contract"]) {
      const shot = structuredClone(UniversalPacketSchema.parse(example).shots[0]!);
      shot.frameworkId = frameworkId;
      shot.dialogue = "Hold the frame.";
      shot.audioTrack.spokenText = "Hold the frame.";
      shot.audioTrack.spokenWindow = { startSeconds: 6, endSeconds: 8 };
      shot.action = "the craftsperson says Hold the frame. and steadies the glass";
      shot.beats[2]!.action = "the craftsperson says Hold the frame. while the liquid settles";
      const compiled = compileShot(shot);
      expect(compiled.videoPrompt.match(/Hold the frame\./g), frameworkId).toHaveLength(1);
      expect(compiled.videoPrompt, frameworkId).toContain("do not begin articulation before 6s");
      expect(compiled.audioPrompt, frameworkId).toContain("Spoken timing: 6-8s");
    }
  });

  it("compiles A-roll as a corpus-native JSON triple-lock contract", () => {
    const packet = UniversalPacketSchema.parse(JSON.parse(
      fs.readFileSync(new URL("../examples/a-roll.json", import.meta.url), "utf8"),
    ));
    const compiled = compileShot(packet.shots[0]!, packet.globalExclusions, packet.globalStyle, {
      aspectRatio: packet.metadata.aspectRatio,
      contentFormat: packet.metadata.format,
      productionTitle: packet.metadata.title,
      sceneTitle: packet.scenes[0]!.title,
    });
    const manifest = JSON.parse(compiled.videoPrompt).project_manifest;
    const compactManifest = JSON.parse(compiled.compactVideoPrompt).project_manifest;

    expect(compiled.frameworkId).toBe("avatar-a-roll-json");
    expect(manifest.manifest_version).toContain("A-Roll JSON");
    expect(manifest.layer_iii_character_and_asset_bible.vocal_signature_lock.pace_wpm).toBe(150);
    expect(manifest.layer_iv_scene_blueprint.keyframe_directives["1_subjects_kinetics_and_phenomenology"]
      .performance_manifest.facial_constraints.head_movement_max_degrees).toBe(3);
    expect(manifest.layer_iv_scene_blueprint.keyframe_directives["4_audio_and_sensory_sync"]
      .locked_audio_profile.phoneme_alignment.acceptance_target_ms).toBe(20);
    expect(manifest.layer_iv_scene_blueprint.keyframe_directives["4_audio_and_sensory_sync"]
      .locked_audio_profile.phoneme_alignment.confidence_min).toBe(0.99);
    expect(manifest.layer_i_global_creative_directive.render_specifications.freeze_pad_frames_at_end).toBe(8);
    expect(manifest.layer_iv_scene_blueprint.keyframe_directives["1_subjects_kinetics_and_phenomenology"]
      .performance_manifest.terminal_hold.freeze_pad_frames_at_end).toBe(8);
    expect(manifest.layer_iv_scene_blueprint.keyframe_directives["1_subjects_kinetics_and_phenomenology"]
      .performance_manifest.terminal_hold.minimum_settle_seconds).toBe(2);
    expect(manifest.layer_iv_scene_blueprint.keyframe_directives["1_subjects_kinetics_and_phenomenology"]
      .performance_manifest.terminal_hold.forbidden_after_final_phoneme).toContain(
      "mouth reopening or silent mouthing",
    );
    expect(manifest.layer_vi_ai_model_constraints.triple_lock_protocol.script_lock.rule).toContain("verbatim once");
    expect(compactManifest.manifest_version).toBe(manifest.manifest_version);
    expect(compactManifest.scene_blueprint.audio_vocal_lock.lip_sync_confidence_min).toBe(0.99);
    expect(compactManifest.scene_blueprint.performance_manifest.terminal_hold.min_seconds).toBe(2);
    expect(compactManifest.scene_blueprint.performance_manifest.terminal_hold.state).toContain("blink");
    expect(compactManifest.scene_blueprint.performance_manifest.terminal_hold.freeze_frames).toBe(8);
    expect(compactManifest.triple_lock_protocol.temporal).toContain("no early beat/reset");
    expect(compiled.videoPrompt.match(/We spent three weeks/g)).toHaveLength(1);
    expect(compiled.compactPromptReport.frameworkPreserved).toBe(true);
    expect(compiled.compactPromptReport.omittedExclusions).toEqual([]);
    expect(compiled.compactPromptReport.truncatedSections).toEqual([]);
  });

  it("hard-routes legacy A-roll packets and emits their exact dialogue once", () => {
    const legacy = structuredClone(JSON.parse(
      fs.readFileSync(new URL("../examples/a-roll.json", import.meta.url), "utf8"),
    ));
    const exactLine = legacy.shots[0].audioTrack.spokenText;
    legacy.shots[0].frameworkId = "continuous-take";
    legacy.shots[0].intent = `The speaker proves the point by saying ${exactLine}`;

    const compiled = compilePacket(legacy).shots[0]!;
    expect(compiled.frameworkId).toBe("avatar-a-roll-json");
    expect(() => JSON.parse(compiled.videoPrompt)).not.toThrow();
    expect(() => JSON.parse(compiled.compactVideoPrompt)).not.toThrow();
    expect(compiled.videoPrompt.split(exactLine)).toHaveLength(2);
    expect(compiled.compactVideoPrompt.split(exactLine)).toHaveLength(2);
  });

  it("does not let one-word A-roll dialogue rewrite fixed safeguards", () => {
    const packet = structuredClone(JSON.parse(
      fs.readFileSync(new URL("../examples/a-roll.json", import.meta.url), "utf8"),
    ));
    packet.shots[0].dialogue = "No.";
    packet.shots[0].audioTrack.spokenText = "No.";
    packet.shots[0].intent = "The speaker answers No. without theatrical emphasis.";
    packet.shots[0].beats = [
      { startSeconds: 0, endSeconds: 4, action: "The speaker listens and breathes naturally." },
      { startSeconds: 4, endSeconds: 8, action: "The speaker answers No. and returns to neutral." },
    ];
    packet.shots[0].durationSeconds = 8;
    packet.metadata.targetDurationSeconds = 8;

    const compiled = compilePacket(packet).shots[0]!;
    expect(compiled.videoPrompt.split("No.")).toHaveLength(2);
    expect(compiled.compactVideoPrompt.split("No.")).toHaveLength(2);
    expect(compiled.videoPrompt).toContain("no paraphrase");
    expect(compiled.videoPrompt).toContain("no later action");
    expect(compiled.videoPrompt).toContain("no new action");
    expect(compiled.compactVideoPrompt).toContain("no rewrite");
    expect(compiled.compactVideoPrompt).toContain("no early beat");
  });

  it("blocks impossible A-roll speech windows and terminal holds", () => {
    const packet = UniversalPacketSchema.parse(JSON.parse(
      fs.readFileSync(new URL("../examples/a-roll.json", import.meta.url), "utf8"),
    ));
    const shot = structuredClone(packet.shots[0]!);
    shot.durationSeconds = 8;
    shot.dialogue = "Most AI videos fail before the model generates a frame because the idea never became a production plan.";
    shot.audioTrack.spokenText = shot.dialogue;
    shot.audioTrack.paceWpm = 138;
    shot.audioTrack.spokenWindow = { startSeconds: 0.4, endSeconds: 7.9 };
    shot.performance.freezePadFramesAtEnd = 8;
    shot.beats = [
      { startSeconds: 0, endSeconds: 0.4, action: "hold closed lips" },
      { startSeconds: 0.4, endSeconds: 7.9, action: "say the approved line" },
      { startSeconds: 7.9, endSeconds: 8, action: "hold the terminal frame" },
    ];

    const issues = preflightPacket({
      ...packet,
      metadata: { ...packet.metadata, targetDurationSeconds: 8 },
      scenes: [{ ...packet.scenes[0]!, shotIds: [shot.id] }],
      shots: [shot],
    }).issues;
    expect(issues.map((issue) => issue.code)).toContain("SPOKEN_WINDOW_PACE_CONFLICT");
    expect(issues.map((issue) => issue.code)).toContain("AROLL_TERMINAL_HOLD_CONFLICT");
    expect(issues.map((issue) => issue.code)).toContain("AROLL_DELAYED_SPEECH_RUNTIME_CHECK");
  });

  it("reserves a real A-roll post-phoneme settle window", () => {
    const packet = UniversalPacketSchema.parse(JSON.parse(
      fs.readFileSync(new URL("../examples/a-roll.json", import.meta.url), "utf8"),
    ));
    const shot = structuredClone(packet.shots[0]!);
    shot.durationSeconds = 8;
    shot.dialogue = "One production contract keeps face, voice, timing, and handoff coherent.";
    shot.audioTrack.spokenText = shot.dialogue;
    shot.audioTrack.paceWpm = 140;
    shot.audioTrack.spokenWindow = { startSeconds: 0, endSeconds: 6 };
    shot.performance.freezePadFramesAtEnd = 8;
    shot.beats = [
      { startSeconds: 0, endSeconds: 6, action: "say the approved line exactly once" },
      { startSeconds: 6, endSeconds: 8, action: "hold the closed-lip terminal state" },
    ];

    const safeIssues = preflightPacket({
      ...packet,
      metadata: { ...packet.metadata, targetDurationSeconds: 8 },
      scenes: [{ ...packet.scenes[0]!, shotIds: [shot.id] }],
      shots: [shot],
    }).issues;
    expect(safeIssues.map((issue) => issue.code)).not.toContain("AROLL_TERMINAL_HOLD_CONFLICT");

    shot.audioTrack.spokenWindow.endSeconds = 6.1;
    const unsafeIssues = preflightPacket({
      ...packet,
      metadata: { ...packet.metadata, targetDurationSeconds: 8 },
      scenes: [{ ...packet.scenes[0]!, shotIds: [shot.id] }],
      shots: [shot],
    }).issues;
    expect(unsafeIssues.map((issue) => issue.code)).toContain("AROLL_TERMINAL_HOLD_CONFLICT");
  });

  it("applies provider timing slack before accepting an A-roll speech window", () => {
    const packet = UniversalPacketSchema.parse(JSON.parse(
      fs.readFileSync(new URL("../examples/a-roll.json", import.meta.url), "utf8"),
    ));
    const shot = structuredClone(packet.shots[0]!);
    shot.durationSeconds = 8;
    shot.dialogue = "Most videos fail before generation because the idea never became a production plan.";
    shot.audioTrack.spokenText = shot.dialogue;
    shot.audioTrack.paceWpm = 138;
    shot.audioTrack.spokenWindow = { startSeconds: 0, endSeconds: 6.1 };
    shot.beats = [
      { startSeconds: 0, endSeconds: 6.1, action: "say the approved line exactly once" },
      { startSeconds: 6.1, endSeconds: 8, action: "hold the closed-lip terminal state" },
    ];

    const issues = preflightPacket({
      ...packet,
      metadata: { ...packet.metadata, targetDurationSeconds: 8 },
      scenes: [{ ...packet.scenes[0]!, shotIds: [shot.id] }],
      shots: [shot],
    }).issues;
    expect(issues.map((issue) => issue.code)).toContain("SPOKEN_WINDOW_PACE_CONFLICT");
    expect(issues.map((issue) => issue.code)).toContain("AROLL_TERMINAL_HOLD_CONFLICT");
  });

  it("does not apply the A-roll timing guard to other frameworks", () => {
    const packet = UniversalPacketSchema.parse(JSON.parse(
      fs.readFileSync(new URL("../examples/a-roll.json", import.meta.url), "utf8"),
    ));
    const shot = structuredClone(packet.shots[0]!);
    shot.frameworkId = "continuous-take";
    shot.durationSeconds = 8;
    shot.dialogue = "Most videos fail before generation because the idea never became a production plan.";
    shot.audioTrack.spokenText = shot.dialogue;
    shot.audioTrack.paceWpm = 138;
    shot.audioTrack.spokenWindow = { startSeconds: 0, endSeconds: 6.1 };

    const issues = preflightPacket({
      ...packet,
      metadata: { ...packet.metadata, targetDurationSeconds: 8, format: "short-film" },
      scenes: [{ ...packet.scenes[0]!, shotIds: [shot.id] }],
      shots: [shot],
    }).issues;
    expect(issues.map((issue) => issue.code)).not.toContain("SPOKEN_WINDOW_PACE_CONFLICT");
  });

  it("clips A-roll timeline beats at the terminal-hold boundary", () => {
    const packet = UniversalPacketSchema.parse(JSON.parse(
      fs.readFileSync(new URL("../examples/a-roll.json", import.meta.url), "utf8"),
    ));
    const shot = structuredClone(packet.shots[0]!);
    shot.durationSeconds = 8;
    shot.dialogue = "Hold the production line.";
    shot.audioTrack.spokenText = shot.dialogue;
    shot.audioTrack.paceWpm = 150;
    shot.audioTrack.spokenWindow = { startSeconds: 0, endSeconds: 6 };
    shot.beats = [{ startSeconds: 0, endSeconds: 8, action: "speak, gesture, then settle" }];

    const compiled = compileShot(shot);
    const compact = JSON.parse(compiled.compactVideoPrompt).project_manifest;
    const full = JSON.parse(compiled.videoPrompt).project_manifest;
    const compactTimeline = compact.scene_blueprint.performance_manifest.timeline;
    const fullTimeline = full.layer_iv_scene_blueprint.keyframe_directives["1_subjects_kinetics_and_phenomenology"]
      .performance_manifest.timeline;
    expect(compactTimeline).toEqual([{ seconds: [0, 6], action: "speak, gesture, then settle" }]);
    expect(fullTimeline).toEqual([{ time_range_seconds: [0, 6], action: "speak, gesture, then settle" }]);
    expect(compact.scene_blueprint.performance_manifest.terminal_hold.window).toEqual([6, 8]);
  });

  it("compiles brand control as a positive blank-surface state", () => {
    const shot = structuredClone(UniversalPacketSchema.parse(example).shots[0]!);
    shot.generationRisks = ["BRAND_OR_TEXT_CONTROL"];
    const compiled = compileShot(shot);

    expect(compiled.videoPrompt).toContain("Production design lock:");
    expect(compiled.videoPrompt).toContain("uninterrupted base material, color, finish, and geometry");
    expect(compiled.videoPrompt).not.toContain("No glyph, letter, number");
    expect(compiled.framePrompt).toContain("declared clean surfaces remain uninterrupted");
  });

  it("offers a deterministic compact handoff without losing production categories", () => {
    const shot = UniversalPacketSchema.parse(example).shots[0]!;
    const compact = compileCompactVideoPrompt(shot, example.globalExclusions);
    expect(compact).toBe(compileCompactVideoPrompt(shot, example.globalExclusions));
    expect(compact.split("\n")).toHaveLength(1);
  });

  it("prioritizes shot-specific safeguards over generic exclusions in compact prompts", () => {
    const shot = structuredClone(UniversalPacketSchema.parse(example).shots[0]!);
    shot.exclusions = [
      ...example.globalExclusions,
      "no widened eyes or mugging",
      "do not begin after the contact event",
      "no contact-free object motion",
      "no static payoff pose",
      "no added reaction beat",
      "no reverse motion",
      "no object duplication",
      "no skipped terminal state",
      "no unrelated camera mark",
    ];
    const compact = compileCompactVideoPrompt(shot, example.globalExclusions);
    expect(compact).toContain("no widened eyes or mugging");
    expect(compact).toContain("do not begin after the contact event");
    expect(compact).toContain("no added reaction beat");
    expect(compact).toContain("no unrelated camera mark");
  });

  it("derives depth-of-field character from optics", () => {
    expect(depthOfFieldCharacter({ focalLengthMm: 24, tStop: 8, subjectDistanceMeters: 5 })).toContain("deep focus");
    expect(depthOfFieldCharacter({ focalLengthMm: 85, tStop: 1.4, subjectDistanceMeters: 1.2 })).toContain("very shallow");
  });

  it("bounds compact prompts and reports every omitted safeguard", () => {
    const shot = structuredClone(UniversalPacketSchema.parse(example).shots[0]!);
    shot.exclusions = Array.from({ length: 100 }, (_, index) => (
      `no synthetic failure mode ${index + 1} with duplicated geometry and unrelated motion`
    ));
    const result = compileCompactVideoPromptWithReport(shot);
    expect(result.prompt.length).toBeLessThanOrEqual(result.toolkitBudget);
    expect(result.wasCompacted).toBe(true);
    expect(result.frameworkPreserved).toBe(result.truncatedSections.length === 0);
    expect(result.omittedExclusions.length).toBeGreaterThan(0);
    expect(result.prompt).toContain("no identity drift");
    expect(result.prompt).toContain("no geometry morphing");
    expect(result.characterCount).toBe(result.prompt.length);
  });

  it("reports global exclusions that do not fit the compact prompt budget", () => {
    const shot = structuredClone(UniversalPacketSchema.parse(example).shots[0]!);
    const globalExclusions = Array.from({ length: 40 }, (_, index) => (
      `no global failure mode ${index + 1} with unrelated geometry, text, or motion`
    ));
    const result = compileCompactVideoPromptWithReport(shot, globalExclusions, [], {
      maxCharacters: 1200,
    });
    expect(result.prompt.length).toBeLessThanOrEqual(1200);
    expect(result.omittedExclusions).toContain(globalExclusions.at(-1));
    expect(result.wasCompacted).toBe(true);
  });

  it("compiles a complete package with a passing preflight", () => {
    const twoShotExample = structuredClone(example);
    const secondShot = structuredClone(twoShotExample.shots[0]);
    secondShot.id = "shot-2";
    secondShot.title = "Second pour angle";
    twoShotExample.shots.push(secondShot);
    twoShotExample.scenes[0].shotIds.push(secondShot.id);
    twoShotExample.metadata.targetDurationSeconds = 16;

    const result = compilePacket(twoShotExample);
    expect(result.shots).toHaveLength(2);
    expect(result.preflight.passed).toBe(true);
    expect(result.shots[0]?.videoPrompt).toContain("16:9");
    for (const shot of result.shots) {
      for (const exclusion of twoShotExample.globalExclusions) {
        expect(shot.negativePrompt.split(exclusion)).toHaveLength(2);
        expect(shot.videoPrompt.split(exclusion)).toHaveLength(2);
      }
    }
  });

  it("preserves every required global style term in compiled prompts", () => {
    const result = compilePacket(example);
    for (const style of example.globalStyle) {
      expect(result.shots[0]?.videoPrompt).toContain(style);
      expect(result.shots[0]?.framePrompt).toContain(style);
    }
  });
});

describe("storyboard and QC", () => {
  it("projects shots into useful storyboard panels", () => {
    const board = buildStoryboard(example);
    expect(board[0]).toMatchObject({ shotId: "shot-1", durationSeconds: 8 });
    expect(board[0]?.framePrompt).toContain("hand-blown clear tumbler");
  });

  it("fails a temporal duration mismatch", () => {
    const broken = structuredClone(example);
    broken.shots[0].beats[2].endSeconds = 7;
    const report = preflightPacket(UniversalPacketSchema.parse(broken));
    expect(report.passed).toBe(false);
    expect(report.issues.some((issue) => issue.code === "DURATION_MISMATCH")).toBe(true);
  });

  it("accepts spokenText as a complete required audio contract", () => {
    const spokenOnly = structuredClone(example);
    spokenOnly.shots[0].dialogue = undefined;
    spokenOnly.shots[0].audioTrack = {
      spokenText: "The detail is the proof.",
      soundDesignDirectives: [],
    };
    const report = preflightPacket(UniversalPacketSchema.parse(spokenOnly));
    expect(report.issues.some((issue) => issue.code === "AUDIO_CONTRACT_MISSING")).toBe(false);
  });

  it("preflights exact dialogue timing windows without breaking legacy packets", () => {
    const timed = structuredClone(example);
    timed.shots[0].dialogue = "Hold the frame.";
    timed.shots[0].audioTrack.spokenText = "Hold the frame.";
    timed.shots[0].audioTrack.spokenWindow = { startSeconds: 6, endSeconds: 9 };
    timed.shots[0].generationRisks = ["EXACT_DIALOGUE_AUDIO"];
    const outOfRange = preflightPacket(UniversalPacketSchema.parse(timed));
    expect(outOfRange.issues.some((issue) => issue.code === "SPOKEN_WINDOW_OUT_OF_RANGE")).toBe(true);

    delete timed.shots[0].audioTrack.spokenWindow;
    const legacy = preflightPacket(UniversalPacketSchema.parse(timed));
    expect(legacy.issues.some((issue) => issue.code === "SPOKEN_WINDOW_UNKNOWN")).toBe(true);
    expect(legacy.issues.some((issue) => issue.severity === "error" && issue.code.startsWith("SPOKEN_WINDOW"))).toBe(false);
  });

  it("blocks duplicate shot identifiers", () => {
    const duplicate = structuredClone(example);
    duplicate.shots.push(structuredClone(duplicate.shots[0]));
    duplicate.scenes[0].shotIds.push("shot-1");
    duplicate.metadata.targetDurationSeconds = 16;
    const report = preflightPacket(UniversalPacketSchema.parse(duplicate));
    expect(report.passed).toBe(false);
    expect(report.issues.some((issue) => issue.code === "DUPLICATE_SHOT_ID")).toBe(true);
  });

  it("builds a constrained repair prompt", () => {
    const prompt = buildRepairPrompt({
      failure: "OBJECT_CONSERVATION",
      observedSymptom: "The glass disappears after the pour begins.",
      preserve: ["camera move", "workshop light", "glass geometry"],
    });
    expect(prompt).toContain("persistent objects");
    expect(prompt).toContain("PRESERVE");
  });

  it("repairs exaggerated performance without redesigning the shot", () => {
    const prompt = buildRepairPrompt({
      failure: "PERFORMANCE_EXAGGERATION",
      observedSymptom: "The actor widens their eyes instead of holding the deadpan beat.",
      preserve: ["actor identity", "elevator geometry", "board dimensions"],
    });
    expect(prompt).toContain("one observable micro-expression");
    expect(prompt).toContain("forbid mugging");
  });
});
