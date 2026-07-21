import type { Optics, Shot, UniversalPacket } from "./schemas.js";
import { parseUniversalPacket, ShotSchema } from "./schemas.js";
import { getFramework } from "./frameworks.js";
import { preflightPacket, preflightShot, type PreflightIssue } from "./qc.js";

export interface CompiledShot {
  shotId: string;
  frameworkId: string;
  videoPrompt: string;
  compactVideoPrompt: string;
  compactPromptReport: CompactPromptReport;
  framePrompt: string;
  audioPrompt: string | null;
  negativePrompt: string;
  qcIssues: PreflightIssue[];
}

export const TOOLKIT_COMPACT_PROMPT_BUDGET = 4000;

export interface CompactPromptOptions {
  maxCharacters?: number;
}

export interface CompactPromptReport {
  toolkitBudget: number;
  characterCount: number;
  wasCompacted: boolean;
  omittedExclusions: string[];
  truncatedSections: string[];
}

export interface CompactPromptResult extends CompactPromptReport {
  prompt: string;
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

const clipSection = (value: string, maxCharacters: number): string => {
  if (value.length <= maxCharacters) return value;
  if (maxCharacters <= 3) return value.slice(0, maxCharacters);
  const raw = value.slice(0, maxCharacters - 3);
  const wordBoundary = raw.lastIndexOf(" ");
  const clipped = wordBoundary > 12 ? raw.slice(0, wordBoundary) : raw;
  return clipped.trimEnd() + "...";
};

export function compileCompactVideoPromptWithReport(
  input: Shot,
  globalExclusions: readonly string[] = [],
  globalStyle: readonly string[] = [],
  options: CompactPromptOptions = {},
): CompactPromptResult {
  const shot = ShotSchema.parse(input);
  const toolkitBudget = options.maxCharacters ?? TOOLKIT_COMPACT_PROMPT_BUDGET;
  if (!Number.isInteger(toolkitBudget) || toolkitBudget < 1000) {
    throw new Error("Compact prompt maxCharacters must be an integer of at least 1000.");
  }
  const spokenText = shot.dialogue ?? shot.audioTrack.spokenText;
  const shotSpecificExclusions = shot.exclusions.filter(
    (exclusion) => !globalExclusions.includes(exclusion),
  );
  const mandatoryExclusions = [
    "no identity drift",
    "no geometry morphing",
    "no unplanned logos",
  ];
  const candidateExclusions = [...new Set([
    ...shotSpecificExclusions,
    ...globalExclusions,
  ])].filter((exclusion) => !mandatoryExclusions.includes(exclusion));
  const audio = [
    spokenText ? "spoken: " + spokenText : null,
    shot.audioTrack.soundDesignDirectives.length
      ? compactList(firstOne(shot.audioTrack.soundDesignDirectives))
      : null,
    shot.audioTrack.musicDirective,
  ].filter((part): part is string => Boolean(part)).join("; ");

  const rawSections = [
    "Intent: " + sentence(shot.intent),
    "Scene: " + sentence(shot.subject + " in " + shot.environment),
    shot.materials.length ? "Materials: " + compactList(firstTwo(shot.materials)) + "." : null,
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
  ].filter((part): part is string => Boolean(part));
  const compose = (sections: string[], exclusions: string[]): string => [
    ...sections,
    "Avoid: " + compactList(exclusions) + ".",
  ].join(" ");
  let sections = rawSections;
  const truncatedSections: string[] = [];
  if (compose(sections, mandatoryExclusions).length > toolkitBudget) {
    const perSectionBudget = Math.max(48, Math.floor((toolkitBudget - 320) / rawSections.length));
    sections = rawSections.map((section) => {
      const clipped = clipSection(section, perSectionBudget);
      if (clipped !== section) truncatedSections.push(section.split(":", 1)[0]!);
      return clipped;
    });
  }
  if (compose(sections, mandatoryExclusions).length > toolkitBudget) {
    throw new Error("Compact prompt minimum contract exceeds the toolkit-owned character budget.");
  }

  const selectedExclusions: string[] = [];
  const omittedExclusions: string[] = [];
  for (const exclusion of candidateExclusions) {
    const candidate = [...selectedExclusions, exclusion, ...mandatoryExclusions];
    if (compose(sections, candidate).length <= toolkitBudget) selectedExclusions.push(exclusion);
    else omittedExclusions.push(exclusion);
  }
  const prompt = compose(sections, [...selectedExclusions, ...mandatoryExclusions]);
  return {
    prompt,
    toolkitBudget,
    characterCount: prompt.length,
    wasCompacted: truncatedSections.length > 0 || omittedExclusions.length > 0,
    omittedExclusions,
    truncatedSections,
  };
}

export function compileCompactVideoPrompt(
  input: Shot,
  globalExclusions: readonly string[] = [],
  globalStyle: readonly string[] = [],
  options: CompactPromptOptions = {},
): string {
  return compileCompactVideoPromptWithReport(input, globalExclusions, globalStyle, options).prompt;
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
  const compact = compileCompactVideoPromptWithReport(shot, globalExclusions, globalStyle);
  const { prompt: compactVideoPrompt, ...compactPromptReport } = compact;

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
    compactVideoPrompt,
    compactPromptReport,
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
