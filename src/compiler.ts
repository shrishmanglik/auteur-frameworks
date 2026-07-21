import type { Optics, Shot, UniversalPacket } from "./schemas.js";
import { parseUniversalPacket, ShotSchema } from "./schemas.js";
import { getFramework } from "./frameworks.js";
import { preflightPacket, preflightShot, type PreflightIssue } from "./qc.js";

export interface CompiledShot {
  shotId: string;
  frameworkId: string;
  videoPrompt: string;
  compactVideoPrompt: string;
  framePrompt: string;
  audioPrompt: string | null;
  negativePrompt: string;
  qcIssues: PreflightIssue[];
}

export interface CompiledPackage {
  schemaVersion: "1.0.0";
  title: string;
  providerTarget: string;
  shots: CompiledShot[];
  preflight: ReturnType<typeof preflightPacket>;
}

export function depthOfFieldCharacter(optics: Optics): string {
  const shallowScore = (optics.focalLengthMm / 50) * (2.8 / optics.tStop) * (3 / optics.subjectDistanceMeters);
  if (shallowScore >= 2.2) return "very shallow depth of field with rapid falloff";
  if (shallowScore >= 1.0) return "shallow depth of field with controlled subject separation";
  if (shallowScore >= 0.45) return "moderate depth of field with readable environment";
  return "deep focus with foreground-to-background legibility";
}

export function opticsToProse(optics: Optics): string {
  const body = optics.cameraBody ? "Shot on " + optics.cameraBody : "Shot on a cinema camera";
  const lens = optics.lensModel ? optics.lensModel + ", " : "";
  return body + " with " + lens + optics.focalLengthMm + "mm optics at T" + optics.tStop
    + ", camera " + optics.subjectDistanceMeters + "m from subject, "
    + depthOfFieldCharacter(optics) + ".";
}

const timedBeats = (shot: Shot): string => shot.beats
  .map((beat) => "[" + beat.startSeconds + "-" + beat.endSeconds + "s] " + beat.action)
  .join(" ");

const sentence = (value: string): string => {
  const trimmed = value.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : trimmed + ".";
};

const compactList = (values: readonly string[]): string => values.join("; ");
const firstTwo = (values: readonly string[]): readonly string[] => values.slice(0, 2);
const firstOne = (values: readonly string[]): readonly string[] => values.slice(0, 1);

const compactOptics = (optics: Optics): string => [
  optics.cameraBody,
  optics.lensModel ?? optics.focalLengthMm + "mm lens",
  "T" + optics.tStop,
  optics.subjectDistanceMeters + "m from subject",
  depthOfFieldCharacter(optics).replace("depth of field", "DOF"),
].filter(Boolean).join(", ");

export function compileCompactVideoPrompt(
  input: Shot,
  globalExclusions: readonly string[] = [],
  globalStyle: readonly string[] = [],
): string {
  const shot = ShotSchema.parse(input);
  const spokenText = shot.dialogue ?? shot.audioTrack.spokenText;
  const exclusions = [...new Set([
    ...globalExclusions,
    ...shot.exclusions,
    "no identity drift",
    "no geometry morphing",
    "no unplanned logos",
  ])];
  const compactExclusions = [...new Set([
    ...exclusions.slice(0, 4),
    "no identity drift",
    "no geometry morphing",
    "no unplanned logos",
  ])];
  const audio = [
    spokenText ? "spoken: " + spokenText : null,
    shot.audioTrack.soundDesignDirectives.length
      ? compactList(firstOne(shot.audioTrack.soundDesignDirectives))
      : null,
    shot.audioTrack.musicDirective,
  ].filter((part): part is string => Boolean(part)).join("; ");

  return [
    "Intent: " + sentence(shot.intent),
    "Scene: " + sentence(shot.subject + " in " + shot.environment),
    globalStyle.length ? "Style: " + compactList(firstTwo(globalStyle)) + "." : null,
    "Camera: " + compactOptics(shot.camera.optics) + "; " + compactList([
      shot.camera.movement,
      shot.camera.framing,
      shot.camera.focusBehavior,
    ]) + ".",
    "Beats: " + timedBeats(shot) + ".",
    "Light: " + shot.lighting.primarySource + "; motivated by " + shot.lighting.motivation
      + ".",
    "Physics: " + compactList(firstOne(shot.physics)) + ".",
    "Lock: " + compactList(firstTwo(shot.continuityLocks)) + ".",
    shot.imperfectionAnchors.length ? "Reality: " + compactList(firstOne(shot.imperfectionAnchors)) + "." : null,
    audio ? "Audio: " + audio + "." : "Audio: visual-only; no invented dialogue.",
    shot.onScreenText ? "Reserve clean space for post-composited text: " + shot.onScreenText + "." : null,
    "Avoid: " + compactList(compactExclusions) + ".",
  ].filter((part): part is string => Boolean(part)).join(" ");
}

export function compileShot(
  input: Shot,
  globalExclusions: readonly string[] = [],
  globalStyle: readonly string[] = [],
): CompiledShot {
  const shot = ShotSchema.parse(input);
  const framework = getFramework(shot.frameworkId);
  const optics = opticsToProse(shot.camera.optics);
  const spokenText = shot.dialogue ?? shot.audioTrack.spokenText;
  const audioParts = [
    spokenText ? "Spoken performance: " + spokenText : null,
    shot.audioTrack.soundDesignDirectives.length
      ? "Sound design: " + shot.audioTrack.soundDesignDirectives.join("; ")
      : null,
    shot.audioTrack.musicDirective ? "Music: " + shot.audioTrack.musicDirective : null,
  ].filter((part): part is string => Boolean(part));
  const exclusions = [...new Set([
    ...globalExclusions,
    ...shot.exclusions,
    "no identity drift",
    "no geometry morphing",
    "no unplanned logos",
  ])];

  const videoPrompt = [
    "FRAMEWORK: " + framework.name + ".",
    globalStyle.length ? "STYLE: " + globalStyle.join("; ") + "." : null,
    "SHOT INTENT: " + sentence(shot.intent),
    "REALITY: " + sentence(shot.subject + " in " + shot.environment)
      + (shot.materials.length ? " Materials: " + shot.materials.join(", ") + "." : ""),
    "CAMERA: " + optics + " " + shot.camera.movement + "; " + shot.camera.shotType + "; " + shot.camera.framing
      + "; focus behavior: " + shot.camera.focusBehavior + ".",
    "TEMPORAL PLAN: " + timedBeats(shot) + ".",
    "LIGHTING: " + shot.lighting.primarySource + ", motivated by " + shot.lighting.motivation
      + "; palette " + shot.lighting.paletteBase.join(", ") + ".",
    "PHYSICS: " + shot.physics.join("; ") + ".",
    "CONTINUITY LOCKS: " + shot.continuityLocks.join("; ") + ".",
    shot.imperfectionAnchors.length ? "REALISM ANCHORS: " + shot.imperfectionAnchors.join("; ") + "." : null,
    audioParts.length ? "AUDIO: " + audioParts.join(" ") : "AUDIO: visual-only; do not invent dialogue.",
    shot.onScreenText ? "TEXT HANDOFF: reserve clean negative space for post-composited copy: " + shot.onScreenText + "." : null,
    "EXCLUSIONS: " + exclusions.join("; ") + ".",
  ].filter((part): part is string => Boolean(part)).join("\n");

  const framePrompt = [
    shot.subject + " in " + shot.environment + ".",
    globalStyle.length ? "Style: " + globalStyle.join("; ") + "." : null,
    optics,
    shot.camera.shotType + ", " + shot.camera.framing + ".",
    shot.lighting.primarySource + "; " + shot.lighting.paletteBase.join(", ") + ".",
    shot.materials.length ? "Materials: " + shot.materials.join(", ") + "." : null,
    shot.imperfectionAnchors.length ? "Realism anchors: " + shot.imperfectionAnchors.join("; ") + "." : null,
    "Continuity: " + shot.continuityLocks.join("; ") + ".",
  ].filter((part): part is string => Boolean(part)).join(" ");

  return {
    shotId: shot.id,
    frameworkId: framework.id,
    videoPrompt,
    compactVideoPrompt: compileCompactVideoPrompt(shot, globalExclusions, globalStyle),
    framePrompt,
    audioPrompt: audioParts.length ? audioParts.join(" ") : null,
    negativePrompt: exclusions.join(", "),
    qcIssues: preflightShot(shot),
  };
}

export function compilePacket(input: unknown): CompiledPackage {
  const packet: UniversalPacket = parseUniversalPacket(input);
  return {
    schemaVersion: "1.0.0",
    title: packet.metadata.title,
    providerTarget: packet.metadata.providerTarget,
    shots: packet.shots.map((shot) => compileShot(shot, packet.globalExclusions, packet.globalStyle)),
    preflight: preflightPacket(packet),
  };
}
