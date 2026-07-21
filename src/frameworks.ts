export type EvidenceClass = "PROMPT_CORPUS" | "RENDER_VALIDATED" | "COMBINED";

export interface FrameworkDefinition {
  id: string;
  name: string;
  purpose: string;
  bestFor: string[];
  requiredBlocks: string[];
  evidenceClass: EvidenceClass;
}

export const FRAMEWORKS: readonly FrameworkDefinition[] = [
  {
    id: "cinematic-prose-stack",
    name: "Cinematic Prose Stack",
    purpose: "Compile one premium shot from premise through optics, physical reality, temporal action, sound, and exclusions.",
    bestFor: ["product-film", "ad", "b-roll", "character-scene"],
    requiredBlocks: ["premise", "reality", "camera", "temporal", "lighting", "physics", "audio", "exclusions"],
    evidenceClass: "COMBINED",
  },
  {
    id: "act-shot-master-spec",
    name: "Act and Shot Master Spec",
    purpose: "Compose a multi-beat sequence with escalation, payoff, and continuity across shots.",
    bestFor: ["short-film", "music-video", "sequence", "ad"],
    requiredBlocks: ["story", "master-spec", "shots", "continuity", "audio", "payoff"],
    evidenceClass: "PROMPT_CORPUS",
  },
  {
    id: "json-scene-contract",
    name: "JSON Scene Contract",
    purpose: "Represent a production as parseable, versionable, provider-neutral structured data.",
    bestFor: ["short-film", "ad", "sequence", "animation"],
    requiredBlocks: ["metadata", "scene", "camera", "lighting", "timeline", "constraints"],
    evidenceClass: "PROMPT_CORPUS",
  },
  {
    id: "temporal-evolution",
    name: "Temporal Evolution Framework",
    purpose: "Control transformations by declaring initial state, visible phases, immutable locks, and final state.",
    bestFor: ["vfx", "animation", "sequence", "product-film"],
    requiredBlocks: ["initial-state", "phases", "immutable-locks", "physics", "final-state"],
    evidenceClass: "COMBINED",
  },
  {
    id: "timed-social-sequence",
    name: "Timed Social Sequence",
    purpose: "Build a short-form hook, escalation, reveal, payoff, and audio rhythm inside a strict duration.",
    bestFor: ["reel", "ad", "music-video"],
    requiredBlocks: ["hook", "timeline", "camera", "reveal", "audio", "platform"],
    evidenceClass: "PROMPT_CORPUS",
  },
  {
    id: "practical-stunt-contract",
    name: "Practical Stunt Contract",
    purpose: "Anchor action in mass, friction, contact, momentum, camera choreography, and practical image behavior.",
    bestFor: ["vfx", "short-film", "ad"],
    requiredBlocks: ["acquisition", "reality", "choreography", "image-science", "audio", "exclusions"],
    evidenceClass: "COMBINED",
  },
  {
    id: "continuous-take",
    name: "Continuous Take",
    purpose: "Express one unbroken action with a clear start, middle, end, and stable subject identity.",
    bestFor: ["a-roll", "character-scene", "b-roll", "product-film"],
    requiredBlocks: ["duration", "identity", "camera", "action-arc", "lighting", "audio", "exclusions"],
    evidenceClass: "COMBINED",
  },
  {
    id: "repair-pass",
    name: "Constrained Repair Pass",
    purpose: "Correct one observed defect while preserving the shot identity and forbidding recurrence.",
    bestFor: ["vfx", "animation", "product-film", "character-scene", "other"],
    requiredBlocks: ["defect", "correction", "preserve", "forbid"],
    evidenceClass: "COMBINED",
  },
  {
    id: "audio-contract",
    name: "Audio Contract",
    purpose: "Specify dialogue, source hierarchy, sync points, acoustic space, and mix intent without inventing unsupported capability.",
    bestFor: ["a-roll", "short-film", "ad", "music-video"],
    requiredBlocks: ["primary-source", "ambience", "sync", "space", "music-boundary", "exclusions"],
    evidenceClass: "PROMPT_CORPUS",
  },
] as const;

export function getFramework(id: string): FrameworkDefinition {
  const framework = FRAMEWORKS.find((item) => item.id === id);
  if (!framework) throw new Error("Unknown framework: " + id);
  return framework;
}
