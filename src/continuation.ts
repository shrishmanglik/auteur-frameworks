import { depthOfFieldCharacter } from "./compiler.js";
import { ContinuationInputSchema, type ContinuationInput } from "./schemas.js";

export interface CompiledContinuation {
  sourceShotId: string;
  targetShotId: string;
  frameworkId: "render-observed-continuation";
  prompt: string;
  negativePrompt: string;
}

const compactList = (values: readonly string[]): string => values.join("; ");
const withoutTerminalPunctuation = (value: string): string => value.trim().replace(/[.!?]+$/, "");

const timedBeatsAfterBridge = (input: ContinuationInput): string => input.shot.beats
  .filter((beat) => beat.endSeconds > input.contract.spatialBridge.completeBySeconds)
  .map((beat) => {
    const clippedStart = Math.max(beat.startSeconds, input.contract.spatialBridge.completeBySeconds);
    const prefix = beat.startSeconds < input.contract.spatialBridge.completeBySeconds ? "continue: " : "";
    return "[" + clippedStart + "-" + beat.endSeconds + "s] " + prefix + beat.action;
  })
  .join(" ");

export function compileContinuationPrompt(input: unknown): CompiledContinuation {
  const parsed = ContinuationInputSchema.parse(input);
  const { contract, shot } = parsed;
  const downstreamBeats = timedBeatsAfterBridge(parsed);
  const suppliedExclusions = [
    ...parsed.globalExclusions,
    ...shot.exclusions,
  ];
  const exclusions = [...new Set([
    ...contract.forbiddenTransitions.map((item) => "no " + item),
    "no identity drift",
    "no unplanned people",
    "no unplanned props",
    ...suppliedExclusions.filter((item) => !contract.forbiddenTransitions.some((transition) => (
      item.toLowerCase().includes(transition.toLowerCase())
    ))),
  ])];

  const spokenText = (shot.dialogue ?? shot.audioTrack.spokenText)?.trim();
  const spokenPerformance = spokenText && contract.dialogueCue
    ? "AUDIO PERFORMANCE [" + contract.dialogueCue.startSeconds + "-" + contract.dialogueCue.endSeconds
      + "s]: " + contract.dialogueCue.speaker + " says exactly once, \"" + spokenText + "\" Delivery: "
      + contract.dialogueCue.delivery + ". Mix: "
      + (contract.dialogueCue.mixPriority === "foreground"
        ? "intelligible foreground above ambience"
        : "balanced with ambience")
      + ". No paraphrase, repetition, substitute words, or subtitles."
    : null;
  const soundDirectives = [...new Set(
    shot.audioTrack.soundDesignDirectives.map(withoutTerminalPunctuation).filter(Boolean),
  )];
  const audio = [
    !spokenPerformance && spokenText ? "Audio: spoken: \"" + spokenText + "\"." : null,
    soundDirectives.length
      ? "Sound: " + compactList(soundDirectives) + "."
      : null,
    shot.audioTrack.musicDirective
      ? "Music: " + withoutTerminalPunctuation(shot.audioTrack.musicDirective) + "."
      : null,
  ].filter((part): part is string => Boolean(part)).join(" ");

  const optics = shot.camera.optics;
  const camera = [
    optics.lensModel ?? optics.focalLengthMm + "mm lens",
    "T" + optics.tStop,
    depthOfFieldCharacter(optics),
    shot.camera.focusBehavior,
  ].join(", ");

  const prompt = [
    "FRAME 0 MATCH: " + contract.exactFinalFrame + ". Same subject: " + contract.subjectReference
      + ". No reset, restage, reframe, pose drift, scale drift, or geometry substitution.",
    "ONE UNBROKEN TAKE: hold camera body, lens, height, axis, and screen direction through first motion.",
    spokenPerformance,
    "LOCK: " + compactList(contract.preservedState) + ".",
    "BY " + contract.firstMotion.mustBeginBySeconds + "s - FIRST MOTION: "
      + contract.firstMotion.action + " -> " + contract.firstMotion.visibleResult + ".",
    "BY " + contract.spatialBridge.completeBySeconds + "s - PHYSICAL BRIDGE: "
      + contract.spatialBridge.sourceGeometry + "; " + contract.spatialBridge.transitionMechanism
      + "; then " + contract.spatialBridge.destinationGeometry + ".",
    "CAMERA PATH: " + contract.spatialBridge.cameraPath
      + ". Reach every composition by visible camera motion; no lens, height, axis, reverse-angle, or coverage jump.",
    downstreamBeats ? "BEATS: " + downstreamBeats + "." : "THEN: " + shot.action + ".",
    "CAMERA/FOCUS: " + camera + ".",
    parsed.globalStyle.length ? "Style: " + compactList(parsed.globalStyle.slice(0, 2)) + "." : null,
    "Light: " + shot.lighting.primarySource + "; " + shot.lighting.motivation + ".",
    "Physics: " + compactList(contract.physicsInvariants) + ".",
    audio || (spokenPerformance ? null : "Audio: preserve existing ambience; invent no dialogue."),
    "END VIA SAME CAMERA PATH: " + contract.finalFrameHandoff + ".",
    "AVOID: " + compactList(exclusions) + ".",
  ].filter((part): part is string => Boolean(part)).join(" ");

  return {
    sourceShotId: contract.sourceShotId,
    targetShotId: shot.id,
    frameworkId: "render-observed-continuation",
    prompt,
    negativePrompt: exclusions.join(", "),
  };
}
