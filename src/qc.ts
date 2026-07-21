import type { Shot, UniversalPacket } from "./schemas.js";
import { getFramework } from "./frameworks.js";
import { assessShotConstraintBudget, assessShotRoute } from "./route-advisor.js";

export type IssueSeverity = "error" | "warning";

export interface PreflightIssue {
  code: string;
  severity: IssueSeverity;
  shotId?: string;
  message: string;
  action: string;
}

export interface PreflightReport {
  passed: boolean;
  issues: PreflightIssue[];
}

const textRisk = (shot: Shot): PreflightIssue[] => shot.onScreenText
  ? [{
      code: "GENERATED_TEXT_RISK",
      severity: "warning",
      shotId: shot.id,
      message: "Generated typography can drift or become illegible across frames.",
      action: "Reserve clean negative space and composite approved typography after generation.",
    }]
  : [];

export function preflightShot(shot: Shot, audioRequired = false): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  getFramework(shot.frameworkId);
  const constraintBudget = assessShotConstraintBudget(shot);
  const route = assessShotRoute(shot);

  if (constraintBudget.status === "overloaded") {
    issues.push({
      code: "SHOT_CONSTRAINT_OVERLOAD",
      severity: "error",
      shotId: shot.id,
      message: `The shot carries ${constraintBudget.score} framework constraint points across ${constraintBudget.factors.length} fragile controls.`,
      action: constraintBudget.recommendation,
    });
  }

  const routeConsumesOpeningFrame = route.recommendedMode === "reference-first"
    || route.recommendedMode === "first-last-frame";
  if (routeConsumesOpeningFrame && shot.beats.length > 1 && !shot.frameStates.opening) {
    issues.push({
      code: "OPENING_FRAME_STATE_FALLBACK",
      severity: "warning",
      shotId: shot.id,
      message: `The multi-stage ${route.recommendedMode} shot has no explicit opening-only frame state, so its generated opening prompt uses a minimal fallback.`,
      action: "Provide frameStates.opening with only the subject, environment, visible inventory, lighting, materials, imperfections, and locks available at 0.0 seconds.",
    });
  }

  if (route.recommendedMode === "first-last-frame" && !shot.frameStates.terminal) {
    issues.push({
      code: "TERMINAL_FRAME_STATE_FALLBACK",
      severity: "warning",
      shotId: shot.id,
      message: "The first/last-frame shot has no explicit terminal-only frame state, so its generated terminal prompt uses composite shot fields.",
      action: "Provide frameStates.terminal with only the subject, environment, visible inventory, lighting, materials, imperfections, and locks present after the final beat completes.",
    });
  }

  if (route.risks.some((risk) => risk.code === "DELAYED_TERMINAL_REVEAL")) {
    if (!shot.frameStates.opening || !shot.frameStates.terminal) {
      issues.push({
        code: "DELAYED_REVEAL_FRAME_STATES_REQUIRED",
        severity: "error",
        shotId: shot.id,
        message: "The delayed reveal cannot be isolated without explicit opening and terminal frame states.",
        action: "Provide frameStates.opening and frameStates.terminal with their exact visible inventories before compiling the split plan.",
      });
    }
    issues.push({
      code: "DELAYED_REVEAL_SINGLE_PASS_BLOCKED",
      severity: "error",
      shotId: shot.id,
      message: "A terminal-only object named in one prompt may contaminate the opening even when a clean first frame is attached.",
      action: "Build a delayed-reveal split plan, dispatch the lexically isolated pre-reveal pass, then compile a render-observed continuation from its accepted final frame.",
    });
  }

  if (shot.imperfectionAnchors.length < 2) {
    issues.push({
      code: "INSUFFICIENT_IMPERFECTION_ANCHORS",
      severity: "warning",
      shotId: shot.id,
      message: "The shot has fewer than two physical imperfection anchors.",
      action: "Add context-specific surface, atmosphere, lens, or human micro-imperfections.",
    });
  }

  if (shot.beats[0]?.startSeconds !== 0) {
    issues.push({
      code: "TIMELINE_START_GAP",
      severity: "error",
      shotId: shot.id,
      message: "The first temporal beat must start at zero.",
      action: "Set the first beat startSeconds to 0.",
    });
  }

  let previousEnd = 0;
  for (const beat of shot.beats) {
    if (beat.startSeconds !== previousEnd) {
      issues.push({
        code: "TIMELINE_GAP_OR_OVERLAP",
        severity: "error",
        shotId: shot.id,
        message: "Temporal beats must be contiguous.",
        action: "Align each beat start with the previous beat end.",
      });
      break;
    }
    previousEnd = beat.endSeconds;
  }

  if (Math.abs(previousEnd - shot.durationSeconds) > 0.001) {
    issues.push({
      code: "DURATION_MISMATCH",
      severity: "error",
      shotId: shot.id,
      message: "The temporal plan does not fill the shot duration.",
      action: "End the final beat at durationSeconds.",
    });
  }

  if (audioRequired && !shot.dialogue && !shot.audioTrack.spokenText
    && shot.audioTrack.soundDesignDirectives.length === 0 && !shot.audioTrack.musicDirective) {
    issues.push({
      code: "AUDIO_CONTRACT_MISSING",
      severity: "error",
      shotId: shot.id,
      message: "Audio is required but the shot has no dialogue, sound design, or music directive.",
      action: "Add an explicit audio contract or mark the production visual-only.",
    });
  }

  if (shot.dialogue && shot.audioTrack.spokenText && shot.dialogue !== shot.audioTrack.spokenText) {
    issues.push({
      code: "SPOKEN_TEXT_CONFLICT",
      severity: "warning",
      shotId: shot.id,
      message: "dialogue and audioTrack.spokenText contain different performances.",
      action: "Choose one canonical spoken performance or make both fields identical.",
    });
  }

  if (shot.audioTrack.spokenWindow && !(shot.dialogue ?? shot.audioTrack.spokenText)) {
    issues.push({
      code: "SPOKEN_WINDOW_WITHOUT_TEXT",
      severity: "error",
      shotId: shot.id,
      message: "A spoken timing window exists without an approved spoken performance.",
      action: "Add spokenText/dialogue or remove the spoken timing window.",
    });
  }

  if (shot.audioTrack.spokenWindow?.endSeconds && shot.audioTrack.spokenWindow.endSeconds > shot.durationSeconds) {
    issues.push({
      code: "SPOKEN_WINDOW_OUT_OF_RANGE",
      severity: "error",
      shotId: shot.id,
      message: "The spoken timing window extends beyond the shot duration.",
      action: "End audioTrack.spokenWindow at or before durationSeconds.",
    });
  }

  const spokenText = shot.dialogue ?? shot.audioTrack.spokenText;
  const spokenWindow = shot.audioTrack.spokenWindow;
  if (spokenText && spokenWindow && shot.audioTrack.paceWpm) {
    const wordCount = spokenText.trim().split(/\s+/).filter(Boolean).length;
    const requiredSeconds = wordCount / shot.audioTrack.paceWpm * 60;
    const availableSeconds = spokenWindow.endSeconds - spokenWindow.startSeconds;
    if (requiredSeconds > availableSeconds + 0.01) {
      issues.push({
        code: "SPOKEN_WINDOW_PACE_CONFLICT",
        severity: "error",
        shotId: shot.id,
        message: `${wordCount} words at ${shot.audioTrack.paceWpm} WPM require about ${requiredSeconds.toFixed(2)}s, but the spoken window allows ${availableSeconds.toFixed(2)}s.`,
        action: "Shorten the approved line, increase the declared pace, or expand the spoken window before generation.",
      });
    }
  }

  if (shot.frameworkId === "avatar-a-roll-json" && spokenWindow) {
    const frameRate = shot.camera.capture.frameRateFps ?? 24;
    const freezePadFrames = shot.performance.freezePadFramesAtEnd ?? 8;
    const latestSpeechEnd = shot.durationSeconds - freezePadFrames / frameRate;
    if (spokenWindow.endSeconds > latestSpeechEnd + 0.001) {
      issues.push({
        code: "AROLL_TERMINAL_HOLD_CONFLICT",
        severity: "error",
        shotId: shot.id,
        message: `Speech ends at ${spokenWindow.endSeconds}s, leaving fewer than ${freezePadFrames} terminal hold frames at ${frameRate}fps.`,
        action: `End speech by ${latestSpeechEnd.toFixed(2)}s, reduce freezePadFramesAtEnd, or increase the shot duration.`,
      });
    }
    if (spokenWindow.startSeconds > 0) {
      issues.push({
        code: "AROLL_DELAYED_SPEECH_RUNTIME_CHECK",
        severity: "warning",
        shotId: shot.id,
        message: "The A-roll contract requests a silent lead-in, but provider timing adherence remains runtime evidence.",
        action: "Measure returned audio onset and reject or reroute the shot if articulation starts before the declared window.",
      });
    }
  }

  if ((shot.dialogue ?? shot.audioTrack.spokenText)
    && shot.generationRisks.includes("EXACT_DIALOGUE_AUDIO")
    && !shot.audioTrack.spokenWindow) {
    issues.push({
      code: "SPOKEN_WINDOW_UNKNOWN",
      severity: "warning",
      shotId: shot.id,
      message: "Exact dialogue has no explicit performance window, so the provider may speak early or late.",
      action: "Set audioTrack.spokenWindow to the intended beat boundaries.",
    });
  }

  if (shot.continuityLocks.length < 2) {
    issues.push({
      code: "CONTINUITY_UNDERSPECIFIED",
      severity: "warning",
      shotId: shot.id,
      message: "Identity, wardrobe, geometry, or environment continuity is underspecified.",
      action: "Add at least two observable continuity locks.",
    });
  }

  return [...issues, ...textRisk(shot)];
}

export function preflightPacket(packet: UniversalPacket): PreflightReport {
  const issues = packet.shots.flatMap((shot) => preflightShot(shot, packet.metadata.audioRequired));
  const sceneIds = new Set(packet.scenes.map((scene) => scene.id));
  const shotIds = new Set(packet.shots.map((shot) => shot.id));
  const characterIds = new Set(packet.characters.map((character) => character.id));
  const totalDuration = packet.shots.reduce((sum, shot) => sum + shot.durationSeconds, 0);
  const duplicateShotIds = [...new Set(packet.shots
    .map((shot) => shot.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index))];
  const duplicateSceneIds = [...new Set(packet.scenes
    .map((scene) => scene.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index))];
  const duplicateCharacterIds = [...new Set(packet.characters
    .map((character) => character.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index))];

  for (const shotId of duplicateShotIds) {
    issues.push({
      code: "DUPLICATE_SHOT_ID",
      severity: "error",
      shotId,
      message: `Shot ID ${shotId} is used more than once.`,
      action: "Assign a unique ID to every shot and update scene shotIds.",
    });
  }

  for (const sceneId of duplicateSceneIds) {
    issues.push({
      code: "DUPLICATE_SCENE_ID",
      severity: "error",
      message: `Scene ID ${sceneId} is used more than once.`,
      action: "Assign a unique ID to every scene and update shot sceneIds.",
    });
  }

  for (const characterId of duplicateCharacterIds) {
    issues.push({
      code: "DUPLICATE_CHARACTER_ID",
      severity: "error",
      message: `Character ID ${characterId} is used more than once.`,
      action: "Assign a unique ID to every character and update shot characterIds.",
    });
  }

  if (Math.abs(totalDuration - packet.metadata.targetDurationSeconds) > 0.001) {
    issues.push({
      code: "PRODUCTION_DURATION_MISMATCH",
      severity: "error",
      message: `Shot durations total ${totalDuration}s but metadata targets ${packet.metadata.targetDurationSeconds}s.`,
      action: "Align shot durations with metadata.targetDurationSeconds.",
    });
  }

  for (const shot of packet.shots) {
    if (packet.characters.length && shot.characterIds.length === 0) {
      issues.push({
        code: "CHARACTER_RELATIONSHIP_UNKNOWN",
        severity: "warning",
        shotId: shot.id,
        message: "The production has characters but this shot does not declare characterIds.",
        action: "Assign the cast members who appear, or keep the relationship explicitly UNKNOWN in the host application.",
      });
    }
    for (const characterId of shot.characterIds) {
      if (!characterIds.has(characterId)) {
        issues.push({
          code: "UNKNOWN_CHARACTER",
          severity: "error",
          shotId: shot.id,
          message: `Shot ${shot.id} references missing character ${characterId}.`,
          action: "Create the character or remove the characterId from the shot.",
        });
      }
    }
    if (!sceneIds.has(shot.sceneId)) {
      issues.push({
        code: "UNKNOWN_SCENE",
        severity: "error",
        shotId: shot.id,
        message: "The shot references a scene that does not exist.",
        action: "Create the scene or update sceneId.",
      });
    }
    const owningScene = packet.scenes.find((scene) => scene.id === shot.sceneId);
    if (owningScene && !owningScene.shotIds.includes(shot.id)) {
      issues.push({
        code: "SHOT_NOT_IN_SCENE",
        severity: "error",
        shotId: shot.id,
        message: `Shot ${shot.id} points to ${shot.sceneId} but is absent from that scene's shotIds.`,
        action: "Add the shot ID to the owning scene or update sceneId.",
      });
    }
  }

  for (const scene of packet.scenes) {
    for (const shotId of scene.shotIds) {
      if (!shotIds.has(shotId)) {
        issues.push({
          code: "UNKNOWN_SHOT",
          severity: "error",
          message: "Scene " + scene.id + " references missing shot " + shotId + ".",
          action: "Create the shot or remove the reference.",
        });
      } else {
        const shot = packet.shots.find((candidate) => candidate.id === shotId);
        if (shot && shot.sceneId !== scene.id) {
          issues.push({
            code: "SCENE_SHOT_MISMATCH",
            severity: "error",
            shotId,
            message: `Scene ${scene.id} lists ${shotId}, but the shot points to ${shot.sceneId}.`,
            action: "Make the scene shotIds and shot.sceneId ownership agree.",
          });
        }
      }
    }
  }

  return {
    passed: !issues.some((issue) => issue.severity === "error"),
    issues,
  };
}
