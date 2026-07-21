import type { Shot, UniversalPacket } from "./schemas.js";
import { getFramework } from "./frameworks.js";

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
  const totalDuration = packet.shots.reduce((sum, shot) => sum + shot.durationSeconds, 0);
  const duplicateShotIds = [...new Set(packet.shots
    .map((shot) => shot.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index))];
  const duplicateSceneIds = [...new Set(packet.scenes
    .map((scene) => scene.id)
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

  if (Math.abs(totalDuration - packet.metadata.targetDurationSeconds) > 0.001) {
    issues.push({
      code: "PRODUCTION_DURATION_MISMATCH",
      severity: "error",
      message: `Shot durations total ${totalDuration}s but metadata targets ${packet.metadata.targetDurationSeconds}s.`,
      action: "Align shot durations with metadata.targetDurationSeconds.",
    });
  }

  for (const shot of packet.shots) {
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
