export type EvidenceClass = "PROMPT_CORPUS" | "RENDER_VALIDATED" | "COMBINED";
export type CompilerSurface = "shot" | "repair" | "continuation";
export type PromptArchitectureStyle = "structured-prose" | "json-contract" | "continuous-prose";

export interface FrameworkDefinition {
  id: string;
  name: string;
  purpose: string;
  bestFor: string[];
  requiredBlocks: string[];
  evidenceClass: EvidenceClass;
  compilerSurface: CompilerSurface;
  architectureStyle: PromptArchitectureStyle;
}

export const FRAMEWORKS: readonly FrameworkDefinition[] = [
  {
    id: "cinematic-prose-stack",
    name: "Cinematic Prose Stack",
    purpose: "Compile one premium shot from premise through optics, physical reality, temporal action, sound, and exclusions.",
    bestFor: ["product-film", "ad", "b-roll", "character-scene"],
    requiredBlocks: ["premise", "reality-anchor", "optics-and-camera", "sequence", "expression-and-exclusions"],
    evidenceClass: "COMBINED",
    compilerSurface: "shot",
    architectureStyle: "structured-prose",
  },
  {
    id: "act-shot-master-spec",
    name: "Act and Shot Master Spec",
    purpose: "Compose a multi-beat sequence with escalation, payoff, and continuity across shots.",
    bestFor: ["short-film", "music-video", "sequence", "ad"],
    requiredBlocks: ["core-visual-concept", "themes", "technical-master-specifications", "act-shot", "continuity-spine", "audio", "payoff"],
    evidenceClass: "PROMPT_CORPUS",
    compilerSurface: "shot",
    architectureStyle: "structured-prose",
  },
  {
    id: "json-scene-contract",
    name: "JSON Scene Contract",
    purpose: "Represent a production as parseable, versionable, provider-neutral structured data.",
    bestFor: ["short-film", "ad", "sequence", "animation"],
    requiredBlocks: ["metadata", "scene", "subject", "camera", "lighting", "timeline", "audio", "constraints", "compiled-prompt"],
    evidenceClass: "PROMPT_CORPUS",
    compilerSurface: "shot",
    architectureStyle: "json-contract",
  },
  {
    id: "avatar-a-roll-json",
    name: "Avatar A-Roll JSON Contract",
    purpose: "Lock a referenced speaker, exact dialogue, restrained facial performance, optics, sound, and acceptance checks into one machine-readable A-roll contract.",
    bestFor: ["a-roll"],
    requiredBlocks: [
      "project-manifest",
      "global-creative-directive",
      "character-asset-bible",
      "performance-manifest",
      "cinematography-optics-psychology",
      "audio-vocal-lock",
      "triple-lock-protocol",
      "acceptance-tests",
    ],
    evidenceClass: "COMBINED",
    compilerSurface: "shot",
    architectureStyle: "json-contract",
  },
  {
    id: "temporal-evolution",
    name: "Temporal Evolution Framework",
    purpose: "Control transformations by declaring initial state, visible phases, immutable locks, and final state.",
    bestFor: ["vfx", "animation", "sequence", "product-film"],
    requiredBlocks: ["transformation-goal", "initial-state", "final-state", "immutable-continuity-keys", "phase-plan", "physics-temporal-rules", "fail-closed-negatives"],
    evidenceClass: "COMBINED",
    compilerSurface: "shot",
    architectureStyle: "structured-prose",
  },
  {
    id: "timed-social-sequence",
    name: "Timed Social Sequence",
    purpose: "Build a short-form hook, escalation, reveal, payoff, and audio rhythm inside a strict duration.",
    bestFor: ["reel", "ad", "music-video"],
    requiredBlocks: ["platform-goal", "hook", "beat-timeline", "visual-language", "retention-share-payoff", "audio-editing", "negatives"],
    evidenceClass: "PROMPT_CORPUS",
    compilerSurface: "shot",
    architectureStyle: "structured-prose",
  },
  {
    id: "practical-stunt-contract",
    name: "Practical Stunt Contract",
    purpose: "Anchor action in mass, friction, contact, momentum, camera choreography, and practical image behavior.",
    bestFor: ["vfx", "short-film", "ad"],
    requiredBlocks: ["core-concept", "acquisition-stack", "reality-anchor", "continuous-camera-move", "contact-mass-momentum", "image-science", "synchronized-audio", "hard-exclusions"],
    evidenceClass: "COMBINED",
    compilerSurface: "shot",
    architectureStyle: "structured-prose",
  },
  {
    id: "continuous-take",
    name: "Continuous Take",
    purpose: "Express one unbroken action with a clear start, middle, end, and stable subject identity.",
    bestFor: ["character-scene", "b-roll", "product-film"],
    requiredBlocks: ["duration", "identity-continuity", "camera-relationship", "action-arc", "lighting-image-behavior", "audio", "exclusions"],
    evidenceClass: "COMBINED",
    compilerSurface: "shot",
    architectureStyle: "continuous-prose",
  },
  {
    id: "repair-pass",
    name: "Constrained Repair Pass",
    purpose: "Correct one observed defect while preserving the shot identity and forbidding recurrence.",
    bestFor: ["vfx", "animation", "product-film", "character-scene", "other"],
    requiredBlocks: ["defect", "correction", "preserve", "forbid"],
    evidenceClass: "COMBINED",
    compilerSurface: "repair",
    architectureStyle: "structured-prose",
  },
  {
    id: "audio-contract",
    name: "Audio Contract",
    purpose: "Specify dialogue, source hierarchy, sync points, acoustic space, and mix intent without inventing unsupported capability.",
    bestFor: ["a-roll", "short-film", "ad", "music-video"],
    requiredBlocks: ["primary-source", "visible-sync-map", "ambience-acoustic-space", "mix-hierarchy", "music-boundary", "exclusions"],
    evidenceClass: "PROMPT_CORPUS",
    compilerSurface: "shot",
    architectureStyle: "structured-prose",
  },
  {
    id: "render-observed-continuation",
    name: "Render-Observed Continuation",
    purpose: "Extend from the actual final frame with a first-motion deadline and an explicit physical bridge into the next shot state.",
    bestFor: ["short-film", "sequence", "ad", "character-scene", "vfx"],
    requiredBlocks: ["observed-final-frame", "preserve", "first-motion", "spatial-bridge", "physics", "handoff"],
    evidenceClass: "RENDER_VALIDATED",
    compilerSurface: "continuation",
    architectureStyle: "structured-prose",
  },
] as const;

export function getFramework(id: string): FrameworkDefinition {
  const framework = FRAMEWORKS.find((item) => item.id === id);
  if (!framework) throw new Error("Unknown framework: " + id);
  return framework;
}
