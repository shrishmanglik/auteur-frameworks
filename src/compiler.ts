import type { Shot, UniversalPacket } from "./schemas.js";
import { parseUniversalPacket, ShotSchema } from "./schemas.js";
import {
  compileFrameworkVideoPrompt,
  type FrameworkPromptContext,
} from "./framework-prompt.js";
import { opticsToProse } from "./optics.js";
import { preflightPacket, preflightShot, type PreflightIssue } from "./qc.js";

export { depthOfFieldCharacter, opticsToProse } from "./optics.js";

export interface CompiledShot {
  shotId: string;
  frameworkId: string;
  frameworkName: string;
  frameworkArchitecture: readonly string[];
  promptFidelity: "FRAMEWORK_NATIVE";
  videoPrompt: string;
  compactVideoPrompt: string;
  compactPromptReport: CompactPromptReport;
  openingFramePrompt: string;
  terminalFramePrompt: string;
  frameStateSources: {
    opening: "explicit" | "minimal-fallback";
    terminal: "explicit" | "composite-fallback";
  };
  /** Back-compatible alias for openingFramePrompt. */
  framePrompt: string;
  audioPrompt: string | null;
  negativePrompt: string;
  qcIssues: PreflightIssue[];
}

export const TOOLKIT_COMPACT_PROMPT_BUDGET = 4000;

export interface CompactPromptOptions {
  maxCharacters?: number;
  context?: FrameworkPromptContext;
}

export interface CompactPromptReport {
  toolkitBudget: number;
  characterCount: number;
  wasCompacted: boolean;
  frameworkPreserved: boolean;
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

  const compactContext: FrameworkPromptContext = {
    ...options.context,
    globalExclusions: [],
    globalStyle,
  };
  const compileWith = (exclusions: readonly string[]): string => {
    const candidateShot = ShotSchema.parse({ ...shot, exclusions });
    const result = compileFrameworkVideoPrompt(candidateShot, compactContext);
    if (result.frameworkId === "json-scene-contract") {
      return JSON.stringify(JSON.parse(result.prompt));
    }
    return result.prompt.replace(/\s*\n+\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  };

  const allOptionalPrompt = compileWith(candidateExclusions);
  if (allOptionalPrompt.length <= toolkitBudget) {
    return {
      prompt: allOptionalPrompt,
      toolkitBudget,
      characterCount: allOptionalPrompt.length,
      wasCompacted: allOptionalPrompt.includes("\n"),
      frameworkPreserved: true,
      omittedExclusions: [],
      truncatedSections: [],
    };
  }

  const selectedExclusions: string[] = [];
  const omittedExclusions: string[] = [];
  let prompt = compileWith(selectedExclusions);
  const truncatedSections: string[] = [];
  if (prompt.length > toolkitBudget) {
    if (shot.frameworkId === "json-scene-contract") {
      throw new Error(
        "Compact JSON Scene Contract exceeds the toolkit-owned character budget. ACTION: use the full videoPrompt or reduce the shot contract without deleting safeguards.",
      );
    }
    const rawSections = compileFrameworkVideoPrompt(
      ShotSchema.parse({ ...shot, exclusions: [] }),
      compactContext,
    ).prompt.split(/\n{2,}/);
    const perSectionBudget = Math.max(64, Math.floor((toolkitBudget - 80) / rawSections.length));
    const sections = rawSections.map((section) => {
      const flattened = section.replace(/\s*\n+\s*/g, " ");
      const clipped = clipSection(flattened, perSectionBudget);
      if (clipped !== flattened) truncatedSections.push(section.split(":", 1)[0]!);
      return clipped;
    });
    prompt = sections.join(" ");
    if (prompt.length > toolkitBudget) {
      throw new Error("Compact framework contract exceeds the toolkit-owned character budget.");
    }
  }

  for (const exclusion of candidateExclusions) {
    const candidate = [...selectedExclusions, exclusion];
    const candidatePrompt = compileWith(candidate);
    if (!truncatedSections.length && candidatePrompt.length <= toolkitBudget) {
      selectedExclusions.push(exclusion);
      prompt = candidatePrompt;
    } else {
      omittedExclusions.push(exclusion);
    }
  }

  return {
    prompt,
    toolkitBudget,
    characterCount: prompt.length,
    wasCompacted: true,
    frameworkPreserved: truncatedSections.length === 0,
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
  context: FrameworkPromptContext = {},
): CompiledShot {
  const shot = ShotSchema.parse(input);
  const optics = opticsToProse(shot.camera.optics);
  const spokenText = shot.dialogue ?? shot.audioTrack.spokenText;
  const audioParts = [
    spokenText ? "Spoken performance: " + spokenText : null,
    spokenText && shot.audioTrack.spokenWindow
      ? "Spoken timing: " + shot.audioTrack.spokenWindow.startSeconds + "-"
        + shot.audioTrack.spokenWindow.endSeconds + "s; no early articulation."
      : null,
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
  const frameworkPrompt = compileFrameworkVideoPrompt(shot, {
    ...context,
    globalExclusions,
    globalStyle,
  });
  const compact = compileCompactVideoPromptWithReport(shot, globalExclusions, globalStyle, {
    context,
  });
  const { prompt: compactVideoPrompt, ...compactPromptReport } = compact;
  const frameSurfaceLock = shot.generationRisks.includes("BRAND_OR_TEXT_CONTROL")
    ? "Production design lock: declared clean surfaces remain uninterrupted base material, color, finish, and geometry."
    : "Reference surface lock: every visible surface contains only its declared base material, color, finish, wear, and geometry; otherwise it remains plain and unbranded.";
  const openingBeat = shot.beats[0]!;
  const terminalBeat = shot.beats[shot.beats.length - 1]!;
  const compileFrameState = (
    phase: "opening" | "terminal",
    temporalBoundary: string,
  ): string => {
    const explicitState = shot.frameStates[phase];
    const isOpening = phase === "opening";
    const stateAction = explicitState?.action ?? (isOpening ? openingBeat.action : terminalBeat.action);
    const stateSubject = explicitState?.subject ?? shot.subject;
    const stateEnvironment = explicitState?.environment ?? (isOpening ? null : shot.environment);
    const stateLighting = explicitState?.lighting ?? shot.lighting.primarySource;
    const statePalette = explicitState?.paletteBase ?? (isOpening ? [] : shot.lighting.paletteBase);
    const stateMaterials = explicitState?.materials ?? (isOpening ? [] : shot.materials);
    const stateImperfections = explicitState?.imperfectionAnchors ?? (isOpening ? [] : shot.imperfectionAnchors);
    const stateContinuity = explicitState?.continuityLocks ?? (isOpening ? [] : shot.continuityLocks);
    const stateLabel = isOpening
      ? "OPENING STATE (0.0s): " + stateAction + "."
      : "TERMINAL STATE (" + shot.durationSeconds + "s): " + stateAction + ".";
    return [
    stateLabel,
    stateSubject + (stateEnvironment ? " in " + stateEnvironment : "") + ".",
    temporalBoundary,
    explicitState?.visibleInventory.length ? "Visible inventory: " + explicitState.visibleInventory.join("; ") + "." : null,
    globalStyle.length ? "Style: " + globalStyle.join("; ") + "." : null,
    optics,
    shot.camera.shotType + ", " + shot.camera.framing + ".",
    stateLighting + (statePalette.length ? "; " + statePalette.join(", ") : "") + ".",
    stateMaterials.length ? "Materials: " + stateMaterials.join(", ") + "." : null,
    stateImperfections.length ? "Realism anchors: " + stateImperfections.join("; ") + "." : null,
    frameSurfaceLock,
    stateContinuity.length ? "Continuity: " + stateContinuity.join("; ") + "." : null,
    ].filter((part): part is string => Boolean(part)).join(" ");
  };

  const openingFramePrompt = compileFrameState(
    "opening",
    "Temporal reference boundary: show only the state available at 0.0s. Any object, contact, pose, illumination, dialogue, transformation, discovery, or completed result assigned to a later beat remains outside frame, occluded, unlit, unstarted, or otherwise unreadable.",
  );
  const terminalFramePrompt = compileFrameState(
    "terminal",
    "Terminal reference boundary: show the completed final beat without beginning a new action, while preserving every declared continuity lock.",
  );

  return {
    shotId: shot.id,
    frameworkId: frameworkPrompt.frameworkId,
    frameworkName: frameworkPrompt.frameworkName,
    frameworkArchitecture: frameworkPrompt.architecture,
    promptFidelity: "FRAMEWORK_NATIVE",
    videoPrompt: frameworkPrompt.prompt,
    compactVideoPrompt,
    compactPromptReport,
    openingFramePrompt,
    terminalFramePrompt,
    frameStateSources: {
      opening: shot.frameStates.opening ? "explicit" : "minimal-fallback",
      terminal: shot.frameStates.terminal ? "explicit" : "composite-fallback",
    },
    framePrompt: openingFramePrompt,
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
    shots: packet.shots.map((shot, shotIndex) => {
      const scene = packet.scenes.find((candidate) => candidate.id === shot.sceneId);
      return compileShot(shot, packet.globalExclusions, packet.globalStyle, {
        aspectRatio: packet.metadata.aspectRatio,
        audience: packet.metadata.audience,
        contentFormat: packet.metadata.format,
        dramaticQuestion: packet.story.dramaticQuestion,
        productionTitle: packet.metadata.title,
        providerTarget: packet.metadata.providerTarget,
        ...(scene ? { scenePurpose: scene.purpose, sceneTitle: scene.title } : {}),
        shotCount: packet.shots.length,
        shotIndex,
        storyLogline: packet.story.logline,
      });
    }),
    preflight: preflightPacket(packet),
  };
}
