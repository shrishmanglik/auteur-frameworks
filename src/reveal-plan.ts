import {
  compileShot,
  type CompiledShot,
} from "./compiler.js";
import type { FrameworkPromptContext } from "./framework-prompt.js";
import {
  assessShotRoute,
  terminalOnlyVisibleInventory,
} from "./route-advisor.js";
import { ShotSchema, type Shot } from "./schemas.js";

const TERMINAL_LEXEME_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "appear",
  "appeared",
  "appearing",
  "appears",
  "at",
  "attached",
  "behind",
  "beside",
  "both",
  "become",
  "becomes",
  "continue",
  "continues",
  "eight",
  "event",
  "five",
  "four",
  "from",
  "in",
  "left",
  "nine",
  "new",
  "one",
  "remain",
  "remains",
  "right",
  "same",
  "seven",
  "six",
  "single",
  "stay",
  "stays",
  "state",
  "terminal",
  "the",
  "three",
  "ten",
  "to",
  "two",
  "visible",
  "with",
]);

const normalize = (value: string): string => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const IRREGULAR_LEXEMES: Readonly<Record<string, string>> = {
  calves: "calf",
  children: "child",
  feet: "foot",
  geese: "goose",
  halves: "half",
  knives: "knife",
  leaves: "leaf",
  lives: "life",
  loaves: "loaf",
  men: "man",
  mice: "mouse",
  people: "person",
  scarves: "scarf",
  selves: "self",
  shelves: "shelf",
  teeth: "tooth",
  thieves: "thief",
  women: "woman",
  wives: "wife",
  wolves: "wolf",
};

const singularizeLexeme = (token: string): string => {
  const irregular = IRREGULAR_LEXEMES[token];
  if (irregular) return irregular;
  if (token.endsWith("ves") && token.length > 4) return `${token.slice(0, -3)}f`;
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (/(?:sses|xes|zes|ches|shes)$/.test(token) && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 3) return token.slice(0, -1);
  return token;
};

const pluralizeLexeme = (token: string): string => {
  if (Object.values(IRREGULAR_LEXEMES).includes(token)) {
    return Object.entries(IRREGULAR_LEXEMES).find(([, singular]) => singular === token)?.[0] ?? token;
  }
  if (token.endsWith("y") && token.length > 2 && !/[aeiou]y$/.test(token)) {
    return `${token.slice(0, -1)}ies`;
  }
  if (/(?:s|x|z|ch|sh)$/.test(token)) return `${token}es`;
  return `${token}s`;
};

const includesAny = (value: string, terms: readonly string[]): boolean => {
  const normalized = ` ${normalize(value)} `;
  return terms.some((term) => normalized.includes(` ${term} `));
};

const lexemes = (values: readonly string[]): string[] => [...new Set(
  values
    .flatMap((value) => normalize(value).split(" "))
    .filter((token) => token.length >= 3 && !TERMINAL_LEXEME_STOPWORDS.has(token)),
)];

const lexemeForms = (token: string): string[] => {
  const singular = singularizeLexeme(token);
  const suffixCandidates = [
    token.endsWith("s") && token.length > 3 ? token.slice(0, -1) : "",
    token.endsWith("es") && token.length > 4 ? token.slice(0, -2) : "",
    token.endsWith("ies") && token.length > 4 ? `${token.slice(0, -3)}y` : "",
    token.endsWith("ves") && token.length > 4 ? `${token.slice(0, -3)}f` : "",
    token.endsWith("ves") && token.length > 4 ? `${token.slice(0, -3)}fe` : "",
  ];
  return [...new Set([
    token,
    singular,
    pluralizeLexeme(singular),
    ...suffixCandidates.filter(Boolean),
  ])];
};

const commonPrefixLength = (left: string, right: string): number => {
  const max = Math.min(left.length, right.length);
  let index = 0;
  while (index < max && left[index] === right[index]) index += 1;
  return index;
};

const stateStrings = (state: NonNullable<Shot["frameStates"]["opening"]>): string[] => [
  state.subject,
  state.action,
  state.environment,
  ...state.visibleInventory,
  state.lighting ?? "",
  ...state.paletteBase,
  ...state.materials,
  ...state.imperfectionAnchors,
  ...state.continuityLocks,
];

const terminalEvidenceStrings = (state: NonNullable<Shot["frameStates"]["terminal"]>): string[] => [
  state.subject,
  state.action,
  state.environment,
  ...state.visibleInventory,
  state.lighting ?? "",
  ...state.paletteBase,
  ...state.materials,
];

const terminalLexemes = (
  opening: NonNullable<Shot["frameStates"]["opening"]>,
  terminal: NonNullable<Shot["frameStates"]["terminal"]>,
  terminalInventory: readonly string[],
): string[] => {
  const openingTerms = lexemes(stateStrings(opening));
  const openingTermForms = new Set(openingTerms.flatMap(lexemeForms));
  const terminalTerms = lexemes([
    ...terminalEvidenceStrings(terminal),
    ...terminalInventory,
  ]);
  const terminalOnlyTerms = terminalTerms.filter((term) => (
    !lexemeForms(term).some((form) => openingTermForms.has(form))
  ));
  const openingActionTerms = lexemes([opening.action]);
  const terminalActionTerms = lexemes([terminal.action]);
  const openingNegatesLaterState = /\b(?:no|not|never|without|unaware|unrecognized|unrecognised|unknown)\b/i.test(opening.action);
  const openingMorphologyVariants = openingNegatesLaterState
    ? openingActionTerms.filter((openingTerm) => terminalActionTerms.some(
      (terminalTerm) => commonPrefixLength(openingTerm, terminalTerm) >= 6,
    ))
    : [];
  return [...new Set([
    ...terminalOnlyTerms.flatMap(lexemeForms),
    ...openingMorphologyVariants.flatMap(lexemeForms),
  ])];
};

const safeStrings = (values: readonly string[], forbiddenTerms: readonly string[]): string[] => values
  .filter((value) => !includesAny(value, forbiddenTerms));

const safeValue = (value: string, forbiddenTerms: readonly string[], fallback: string): string => (
  includesAny(value, forbiddenTerms) ? fallback : value
);

const safeOptionalValue = (
  value: string | undefined,
  forbiddenTerms: readonly string[],
  fallback: string,
): string | undefined => (value ? safeValue(value, forbiddenTerms, fallback) : undefined);

const collectStringValues = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStringValues);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(collectStringValues);
  }
  return [];
};

const safeContext = (
  context: FrameworkPromptContext,
): FrameworkPromptContext => ({
  ...context,
  dramaticQuestion: "Can the declared opening state reach a stable continuation handoff?",
  productionTitle: "Opening-state passage",
  scenePurpose: "Preserve the opening state while building a continuous approach to the handoff.",
  sceneTitle: "Opening-state passage",
  storyLogline: "The subject moves through the declared opening environment toward a stable handoff.",
});

const preRevealBeats = (shot: Shot, forbiddenTerms: readonly string[]): Shot["beats"] => {
  const firstRevealIndex = shot.beats.findIndex((beat) => includesAny(beat.action, forbiddenTerms));
  const source = forbiddenTerms.length && firstRevealIndex > 0
    ? shot.beats.slice(0, firstRevealIndex)
    : firstRevealIndex === -1
      ? shot.beats.slice(0, -1)
      : [];
  if (!source.length) {
    return [{
      startSeconds: 0,
      endSeconds: shot.durationSeconds,
      action: shot.frameStates.opening?.action
        ?? "the subject preserves the declared opening state and settles into a stable handoff",
    }];
  }

  return source.map((beat, index) => ({
    ...beat,
    startSeconds: index === 0 ? 0 : beat.startSeconds,
    endSeconds: index === source.length - 1 ? shot.durationSeconds : beat.endSeconds,
  }));
};

export interface DelayedRevealLexicalAudit {
  passed: boolean;
  forbiddenTerms: string[];
  matches: string[];
  compilerOwnedMatches: string[];
}

export interface DelayedRevealSplitPlan {
  frameworkId: "delayed-reveal-split";
  sourceShotId: string;
  mode: "split-pass";
  terminalOnlyInventory: string[];
  preReveal: {
    shot: Shot;
    prompts: CompiledShot;
    lexicalAudit: DelayedRevealLexicalAudit;
    dispatchInstruction: string;
    acceptanceChecks: string[];
  };
  revealContinuation: {
    frameworkId: "render-observed-continuation";
    status: "REQUIRES_RENDER_OBSERVED_FINAL_FRAME";
    targetFramePrompt: string;
    requiredObservationFields: string[];
    compileInstruction: string;
    acceptanceChecks: string[];
  };
}

export function buildDelayedRevealSplitPlan(
  input: Shot,
  globalExclusions: readonly string[] = [],
  globalStyle: readonly string[] = [],
  context: FrameworkPromptContext = {},
): DelayedRevealSplitPlan {
  const shot = ShotSchema.parse(input);
  const route = assessShotRoute(shot);
  if (!route.risks.some((risk) => risk.code === "DELAYED_TERMINAL_REVEAL")) {
    throw new Error("Delayed reveal split planning requires DELAYED_TERMINAL_REVEAL or terminal-only visible inventory.");
  }
  if (!shot.frameStates.opening || !shot.frameStates.terminal) {
    throw new Error("Delayed reveal split planning requires explicit opening and terminal frame states.");
  }

  const terminalInventory = terminalOnlyVisibleInventory(shot);
  const opening = shot.frameStates.opening;
  const terminal = shot.frameStates.terminal;
  const forbiddenTerms = terminalLexemes(opening, terminal, terminalInventory);
  const beats = preRevealBeats(shot, forbiddenTerms);
  const openingAction = safeValue(
    opening.action,
    forbiddenTerms,
    "the subject preserves the declared opening pose and settles into a stable handoff",
  );
  const safeOpening = {
    ...opening,
    subject: safeValue(opening.subject, forbiddenTerms, "the declared opening-state subject"),
    action: openingAction,
    environment: safeValue(opening.environment, forbiddenTerms, "the declared opening environment"),
    visibleInventory: safeStrings(opening.visibleInventory, forbiddenTerms),
    lighting: opening.lighting
      ? safeValue(opening.lighting, forbiddenTerms, "existing practical and environmental light")
      : undefined,
    paletteBase: safeStrings(opening.paletteBase, forbiddenTerms),
    materials: safeStrings(opening.materials, forbiddenTerms),
    imperfectionAnchors: safeStrings(opening.imperfectionAnchors, forbiddenTerms),
    continuityLocks: safeStrings(opening.continuityLocks, forbiddenTerms),
  };
  const preRevealShot = ShotSchema.parse({
    ...shot,
    id: `${shot.id}-pre-reveal`,
    title: "Opening-state pass",
    intent: "Preserve the declared opening state and build one continuous approach to a stable handoff without introducing the terminal event.",
    subject: safeOpening.subject,
    action: beats.map((beat) => beat.action).join("; ") || openingAction,
    environment: safeOpening.environment,
    camera: {
      ...shot.camera,
      shotType: safeValue(
        shot.camera.shotType,
        forbiddenTerms,
        "single uninterrupted live-action shot",
      ),
      movement: "one restrained continuous move that preserves the opening axis and ends on a stable handoff",
      framing: includesAny(shot.camera.framing, forbiddenTerms)
        ? "preserve the declared opening-state composition"
        : shot.camera.framing,
      focusBehavior: includesAny(shot.camera.focusBehavior, forbiddenTerms)
        ? "hold focus on the opening-state subject without a rack to later information"
        : shot.camera.focusBehavior,
      optics: {
        ...shot.camera.optics,
        cameraBody: safeOptionalValue(
          shot.camera.optics.cameraBody,
          forbiddenTerms,
          "digital cinema camera",
        ),
        lensModel: safeOptionalValue(
          shot.camera.optics.lensModel,
          forbiddenTerms,
          "provider-neutral cinema lens",
        ),
      },
      capture: {
        ...shot.camera.capture,
        sensorFormat: safeOptionalValue(
          shot.camera.capture.sensorFormat,
          forbiddenTerms,
          "cinema sensor",
        ),
        recordingFormat: safeOptionalValue(
          shot.camera.capture.recordingFormat,
          forbiddenTerms,
          "high-dynamic-range acquisition",
        ),
        rig: safeOptionalValue(
          shot.camera.capture.rig,
          forbiddenTerms,
          "continuous camera support",
        ),
        resolutionIntent: safeOptionalValue(
          shot.camera.capture.resolutionIntent,
          forbiddenTerms,
          "cinema finish",
        ),
      },
    },
    materials: safeOpening.materials,
    physics: [
      "movement follows continuous real-world inertia and contact",
      "declared opening inventory remains conserved and geometrically stable",
      "the camera preserves one continuous axis through the final handoff",
    ],
    beats,
    lighting: {
      primarySource: safeOpening.lighting ?? "existing practical and environmental light",
      motivation: safeOpening.lighting ?? "light remains motivated by the declared opening environment",
      paletteBase: safeOpening.paletteBase.length
        ? safeOpening.paletteBase
        : safeStrings(shot.lighting.paletteBase, forbiddenTerms).length
          ? safeStrings(shot.lighting.paletteBase, forbiddenTerms)
          : ["natural location color"],
      isDesaturated: shot.lighting.isDesaturated,
      isCrushedBlacks: shot.lighting.isCrushedBlacks,
    },
    imperfectionAnchors: safeOpening.imperfectionAnchors,
    continuityLocks: safeOpening.continuityLocks.length
      ? safeOpening.continuityLocks
      : ["opening subject identity, object count, geometry, and screen direction remain unchanged"],
    frameStates: { opening: safeOpening },
    generationRisks: shot.generationRisks.filter((risk) => ![
      "DELAYED_TERMINAL_REVEAL",
      "EXACT_DIALOGUE_AUDIO",
      "AUDIO_ACTION_SYNCHRONIZATION",
    ].includes(risk)),
    exclusions: [
      ...safeStrings(shot.exclusions, forbiddenTerms),
      "no terminal event in this pass",
      "no new hero object before the continuation handoff",
    ],
    dialogue: undefined,
    onScreenText: undefined,
    audioTrack: {
      spokenText: undefined,
      spokenWindow: undefined,
      soundDesignDirectives: ["continuous location ambience with no added event cue"],
      musicDirective: undefined,
    },
  });
  const safeGlobalExclusions = safeStrings(globalExclusions, forbiddenTerms);
  const safeGlobalStyle = safeStrings(globalStyle, forbiddenTerms);
  const sanitizedContext = safeContext(context);
  const prompts = compileShot(
    preRevealShot,
    safeGlobalExclusions,
    safeGlobalStyle,
    sanitizedContext,
  );
  const compiledText = [
    prompts.videoPrompt,
    prompts.compactVideoPrompt,
    prompts.openingFramePrompt,
    prompts.terminalFramePrompt,
    prompts.audioPrompt,
    prompts.negativePrompt,
  ].filter((value): value is string => Boolean(value)).join("\n");
  const semanticSourceText = [
    ...collectStringValues({
      intent: preRevealShot.intent,
      subject: preRevealShot.subject,
      action: preRevealShot.action,
      environment: preRevealShot.environment,
      camera: preRevealShot.camera,
      lighting: preRevealShot.lighting,
      physics: preRevealShot.physics,
      materials: preRevealShot.materials,
      beats: preRevealShot.beats,
      continuityLocks: preRevealShot.continuityLocks,
      imperfectionAnchors: preRevealShot.imperfectionAnchors,
      exclusions: preRevealShot.exclusions,
      audioTrack: preRevealShot.audioTrack,
      frameStates: preRevealShot.frameStates,
    }),
    ...safeGlobalExclusions,
    ...safeGlobalStyle,
    ...collectStringValues(sanitizedContext),
  ].join("\n");
  const compiledMatches = forbiddenTerms.filter((term) => includesAny(compiledText, [term]));
  const matches = compiledMatches.filter((term) => includesAny(semanticSourceText, [term]));
  const compilerOwnedMatches = compiledMatches.filter((term) => !matches.includes(term));
  const lexicalAudit = {
    passed: matches.length === 0,
    forbiddenTerms,
    matches,
    compilerOwnedMatches,
  };
  if (!lexicalAudit.passed) {
    throw new Error(`Pre-reveal compilation leaked terminal-only terms: ${matches.join(", ")}.`);
  }

  const targetFramePrompt = compileShot(shot, globalExclusions, globalStyle, context).terminalFramePrompt;
  return {
    frameworkId: "delayed-reveal-split",
    sourceShotId: shot.id,
    mode: "split-pass",
    terminalOnlyInventory: terminalInventory,
    preReveal: {
      shot: preRevealShot,
      prompts,
      lexicalAudit,
      dispatchInstruction: "Dispatch this pre-reveal pass first. Do not attach or mention terminal-only inventory. Accept its actual last frame before compiling the continuation.",
      acceptanceChecks: [
        "Reject any frame containing terminal-only inventory.",
        "Reject a cut, reset, identity drift, geometry substitution, or broken continuity lock.",
        "Harvest the accepted last frame and describe its actual subject pose, camera axis, geometry, lighting, and moving state.",
      ],
    },
    revealContinuation: {
      frameworkId: "render-observed-continuation",
      status: "REQUIRES_RENDER_OBSERVED_FINAL_FRAME",
      targetFramePrompt,
      requiredObservationFields: [
        "exactFinalFrame",
        "subjectReference",
        "preservedState",
        "firstMotion",
        "spatialBridge",
        "physicsInvariants",
        "finalFrameHandoff",
      ],
      compileInstruction: "After the pre-reveal render passes QC, describe its actual last frame and compile the reveal with compileContinuationPrompt. Never dispatch a prewritten extension against an unobserved boundary.",
      acceptanceChecks: [
        "Frame zero must match the accepted pre-reveal last frame without a reset, reframe, or pose jump.",
        "Terminal-only inventory may appear only through the declared physical reveal path.",
        "Reject an omitted reveal, early reveal, teleport, dissolve, geometry morph, or continuity break.",
      ],
    },
  };
}
