import { ShotSchema, type GenerationRiskCode, type Shot } from "./schemas.js";

export type RouteRiskLevel = "low" | "medium" | "high";
export type GenerationMode = "text-only" | "reference-first" | "first-last-frame" | "split-pass";

export type RouteRiskCode = GenerationRiskCode | "COMPOUND_CONSTRAINT_OVERLOAD";

export type ConstraintFactorCode =
  | "MULTI_STAGE_ACTION"
  | "DELAYED_EXACT_DIALOGUE"
  | "STRICT_SURFACE_CONTROL"
  | "IDENTITY_LOCK"
  | "HIGH_RISK_CHOREOGRAPHY";

export interface ShotConstraintFactor {
  code: ConstraintFactorCode;
  weight: number;
  reason: string;
}

export interface ShotConstraintBudget {
  score: number;
  status: "within-budget" | "elevated" | "overloaded";
  factors: ShotConstraintFactor[];
  recommendation: string;
}

export interface RouteRisk {
  code: RouteRiskCode;
  level: Exclude<RouteRiskLevel, "low">;
  reason: string;
  mitigation: string;
}

export interface ShotRouteAdvice {
  shotId: string;
  riskLevel: RouteRiskLevel;
  recommendedMode: GenerationMode;
  constraintBudget: ShotConstraintBudget;
  risks: RouteRisk[];
  requiredAssets: string[];
  acceptanceChecks: string[];
  providerCapabilityStatus: "UNKNOWN";
  providerCapabilityNote: string;
}

const contains = (text: string, pattern: RegExp): boolean => pattern.test(text);

export function assessShotConstraintBudget(input: Shot): ShotConstraintBudget {
  const shot = ShotSchema.parse(input);
  const explicitRisks = new Set(shot.generationRisks);
  const factors: ShotConstraintFactor[] = [];
  const spokenText = shot.dialogue ?? shot.audioTrack.spokenText;
  const spokenWindow = shot.audioTrack.spokenWindow;

  if (shot.beats.length >= 3) {
    factors.push({
      code: "MULTI_STAGE_ACTION",
      weight: 2,
      reason: "Three or more temporal states must remain ordered inside one generated shot.",
    });
  }
  if (spokenText && spokenWindow && spokenWindow.startSeconds >= shot.durationSeconds / 2) {
    factors.push({
      code: "DELAYED_EXACT_DIALOGUE",
      weight: 2,
      reason: "Exact speech must remain unavailable until the latter half of the shot.",
    });
  }
  if (explicitRisks.has("BRAND_OR_TEXT_CONTROL")) {
    factors.push({
      code: "STRICT_SURFACE_CONTROL",
      weight: 2,
      reason: "Declared surfaces must resist provider-invented markings throughout the take.",
    });
  }
  if (explicitRisks.has("IDENTITY_OR_PERFORMANCE")) {
    factors.push({
      code: "IDENTITY_LOCK",
      weight: 1,
      reason: "Identity and performance amplitude must remain stable while other events unfold.",
    });
  }
  if ([
    "CAUSAL_CONTACT_CHOREOGRAPHY",
    "PRECISE_MECHANICAL_ASSEMBLY",
    "MULTI_SUBJECT_DYNAMICS",
    "PRECISE_SPATIAL_CLEARANCE",
    "EXACT_FLUID_COUNT",
  ].some((risk) => explicitRisks.has(risk as GenerationRiskCode))) {
    factors.push({
      code: "HIGH_RISK_CHOREOGRAPHY",
      weight: 2,
      reason: "The shot contains a physical event that needs endpoint or frame-by-frame verification.",
    });
  }

  const score = factors.reduce((sum, factor) => sum + factor.weight, 0);
  const status = score >= 6 ? "overloaded" : score >= 4 ? "elevated" : "within-budget";
  const recommendation = status === "overloaded"
    ? "Split the shot at a stable handoff state and isolate delayed speech, strict surface control, or high-risk choreography before dispatch."
    : status === "elevated"
      ? "Use the recommended reference route and verify each declared state; simplify if the provider cannot honor the route."
      : "The shot is suitable for its recommended single-pass route, subject to provider capability and returned-media QC.";

  return { score, status, factors, recommendation };
}

export function assessShotRoute(input: Shot): ShotRouteAdvice {
  const shot = ShotSchema.parse(input);
  const constraintBudget = assessShotConstraintBudget(shot);
  const productionText = [
    shot.subject,
    shot.action,
    ...shot.physics,
    ...shot.continuityLocks,
    ...shot.beats.map((beat) => beat.action),
  ].join(" ").toLowerCase();
  const exclusionText = shot.exclusions.join(" ").toLowerCase();
  const explicitRisks = new Set(shot.generationRisks);
  const risks: RouteRisk[] = [];
  const requiredAssets = new Set<string>();
  const acceptanceChecks = new Set<string>([
    "Compare the rendered opening, midpoint, and terminal states against the shot beats.",
    "Reject added objects, identity drift, geometry changes, unplanned text, or an incomplete final state.",
  ]);

  const causalContact = explicitRisks.has("CAUSAL_CONTACT_CHOREOGRAPHY") || contains(
    productionText,
    /\b(?:door|board|vehicle|body|object|tool|hand|wheel)\b[^.]{0,96}\b(?:makes contact|contacts|catches|collides|pins|pivots?)\b|\b(?:makes contact|contacts|catches|collides|pins|pivots?)\b[^.]{0,96}\b(?:door|board|vehicle|body|object|tool|hand|wheel)\b/,
  );
  if (causalContact) {
    risks.push({
      code: "CAUSAL_CONTACT_CHOREOGRAPHY",
      level: "high",
      reason: "The result depends on a visible contact causing a later state change.",
      mitigation: "Provide opening and terminal state frames, isolate one contact event, and reject contact-free motion.",
    });
    requiredAssets.add("opening-state frame with the contact geometry visible");
    requiredAssets.add("terminal-state frame with the completed physical result");
    acceptanceChecks.add("Verify that contact is visible before the caused motion begins.");
  }

  const mechanicalAssembly = explicitRisks.has("PRECISE_MECHANICAL_ASSEMBLY") || contains(
    productionText,
    /\b(?:cap|lid)\b[^.;]{0,48}\b(?:lowers?\s+(?:and\s+)?seats?|seats?\s+(?:on|onto|into|within|against)|inserts?|attaches?|detaches?)\b|\b(?:component|mechanical part|machine part|module|rigid piece)\b[^.;]{0,64}\b(?:assembles?|seats?|inserts?|attaches?|detaches?)\b|\b(?:assembles?|inserts?|attaches?|detaches?)\b[^.;]{0,64}\b(?:cap|lid|component|mechanical part|machine part|module|rigid piece)\b/,
  );
  if (mechanicalAssembly) {
    risks.push({
      code: "PRECISE_MECHANICAL_ASSEMBLY",
      level: "high",
      reason: "Exact object assembly is vulnerable to duplicated parts, orientation drift, or a skipped motion path.",
      mitigation: "Use first/last frames or a provider reference workflow and keep the object inventory explicit.",
    });
    requiredAssets.add("hero object reference with fixed geometry and orientation");
    requiredAssets.add("terminal assembly-state frame");
    acceptanceChecks.add("Count every part and verify one continuous path from separated to assembled state.");
  }

  if (explicitRisks.has("MULTI_SUBJECT_DYNAMICS")) {
    risks.push({
      code: "MULTI_SUBJECT_DYNAMICS",
      level: "high",
      reason: "Multiple independently moving subjects can merge, swap identity, collide, or lose their declared paths.",
      mitigation: "Lock each subject's inventory and trajectory, preserve visible separation, and compare opening and terminal states.",
    });
    requiredAssets.add("opening-state frame with every moving subject identified");
    requiredAssets.add("terminal-state frame with final trajectories and separation visible");
    acceptanceChecks.add("Track every moving subject through the shot; reject merges, swaps, collisions, or undeclared path changes.");
  }

  if (explicitRisks.has("PRECISE_SPATIAL_CLEARANCE")) {
    risks.push({
      code: "PRECISE_SPATIAL_CLEARANCE",
      level: "high",
      reason: "The shot depends on a measurable final gap that text generation can visually collapse or exaggerate.",
      mitigation: "Declare the terminal distance, keep both surfaces visible, and measure the accepted terminal frame.",
    });
    requiredAssets.add("terminal-state frame with both clearance surfaces visible");
    acceptanceChecks.add("Measure the declared terminal clearance in the accepted frame; reject contact or an unreadable gap.");
  }

  const exactFluidCount = explicitRisks.has("EXACT_FLUID_COUNT") || contains(
    productionText,
    /\b(?:exactly|two|three|four|five|\d+)\b[^.]{0,48}\b(?:droplet|drip|bead|splash|ripple)s?\b|\b(?:droplet|drip|bead|splash|ripple)s?\b[^.]{0,48}\b(?:exactly|two|three|four|five|\d+)\b/,
  );
  if (exactFluidCount) {
    risks.push({
      code: "EXACT_FLUID_COUNT",
      level: "high",
      reason: "A numerically exact fluid event can collapse into strands, extra droplets, or resets in one pass.",
      mitigation: "Split the event into one fluid action per pass or treat the count as a forensic QC gate, not a text-only guarantee.",
    });
    requiredAssets.add("accepted fluid-state reference or one-action-per-pass plan");
    acceptanceChecks.add("Count discrete fluid events frame by frame; reject strands, replenishment, and extra impacts.");
  }

  const brandOrText = explicitRisks.has("BRAND_OR_TEXT_CONTROL") || Boolean(shot.onScreenText)
    || contains(productionText, /\b(?:unbranded|blank (?:label|board|surface)|post-composited text|on-screen text)\b/)
    || contains(exclusionText, /\bno (?:logo|logos|badge|badges|wordmark|wordmarks|branding|lettering|license plate|plate lettering)\b/);
  if (brandOrText) {
    risks.push({
      code: "BRAND_OR_TEXT_CONTROL",
      level: "medium",
      reason: "Blank surfaces and generated lettering are vulnerable to provider-invented marks.",
      mitigation: "Use an approved blank reference, reserve copy for post, and scan every surface in QC.",
    });
    requiredAssets.add("approved blank-surface or original-design reference");
    acceptanceChecks.add("Inspect all surfaces for badges, logos, plates, letters, numbers, or watermarks.");
  }

  const identityOrPerformance = explicitRisks.has("IDENTITY_OR_PERFORMANCE") || (
    shot.characterIds.length > 0
    && contains(shot.continuityLocks.join(" ").toLowerCase(), /\b(?:same face|identity|wardrobe|facial expression|performance amplitude)\b/)
  );
  if (identityOrPerformance) {
    risks.push({
      code: "IDENTITY_OR_PERFORMANCE",
      level: "medium",
      reason: "Identity and emotional amplitude can drift even when the action remains readable.",
      mitigation: "Attach an identity reference and specify one bounded observable expression or micro-action.",
    });
    requiredAssets.add("identity and wardrobe reference");
    acceptanceChecks.add("Compare face, wardrobe, anatomy, and emotional amplitude across the full shot.");
  }

  if (explicitRisks.has("TRANSFORMATION_PHASES") || shot.frameworkId === "temporal-evolution"
    || contains(productionText, /\b(?:transform|transformation|turns into|particles? (?:assemble|travel|become))\b/)) {
    risks.push({
      code: "TRANSFORMATION_PHASES",
      level: "medium",
      reason: "A transformation can skip phases, change unrelated geometry, or invent mass.",
      mitigation: "Lock the untouched subject and world, declare visible phases, and verify the terminal object.",
    });
    requiredAssets.add("initial-state reference with immutable geometry marked");
    acceptanceChecks.add("Verify every declared phase and confirm that untouched anatomy and environment remain fixed.");
  }

  if (explicitRisks.has("EXACT_DIALOGUE_AUDIO") || shot.dialogue || shot.audioTrack.spokenText) {
    risks.push({
      code: "EXACT_DIALOGUE_AUDIO",
      level: "medium",
      reason: "A visually acceptable take can still omit, repeat, or paraphrase speech.",
      mitigation: "Keep one quoted line, time-box it, and transcribe the result before acceptance.",
    });
    requiredAssets.add("approved dialogue transcript and pronunciation notes");
    acceptanceChecks.add("Transcribe the rendered speech and compare it word-for-word with the approved line.");
  }

  if (explicitRisks.has("AUDIO_ACTION_SYNCHRONIZATION")) {
    risks.push({
      code: "AUDIO_ACTION_SYNCHRONIZATION",
      level: "medium",
      reason: "The dramatic beat depends on a visible action and an audible event sharing the same frame-accurate cue.",
      mitigation: "Declare the synchronization cue once and inspect waveform and frames together before acceptance.",
    });
    requiredAssets.add("approved action-to-audio cue sheet");
    acceptanceChecks.add("Verify the declared visual action and audio cue align at the intended frame without an early or repeated event.");
  }

  if (constraintBudget.status === "overloaded") {
    risks.push({
      code: "COMPOUND_CONSTRAINT_OVERLOAD",
      level: "high",
      reason: "The shot combines too many independently fragile controls for a provider-neutral single pass.",
      mitigation: constraintBudget.recommendation,
    });
    requiredAssets.add("split-shot plan with a stable visual handoff between isolated control problems");
    acceptanceChecks.add("Reject a single-pass dispatch until the overloaded constraint budget is split or explicitly resolved.");
  }

  const riskLevel: RouteRiskLevel = risks.some((risk) => risk.level === "high")
    ? "high"
    : risks.length
      ? "medium"
      : "low";
  const codes = new Set(risks.map((risk) => risk.code));
  const recommendedMode: GenerationMode = codes.has("COMPOUND_CONSTRAINT_OVERLOAD") || codes.has("EXACT_FLUID_COUNT")
    ? "split-pass"
    : codes.has("PRECISE_MECHANICAL_ASSEMBLY") || codes.has("CAUSAL_CONTACT_CHOREOGRAPHY")
      || codes.has("MULTI_SUBJECT_DYNAMICS") || codes.has("PRECISE_SPATIAL_CLEARANCE")
      ? "first-last-frame"
      : codes.has("BRAND_OR_TEXT_CONTROL") || codes.has("IDENTITY_OR_PERFORMANCE") || codes.has("TRANSFORMATION_PHASES")
        ? "reference-first"
        : "text-only";

  return {
    shotId: shot.id,
    riskLevel,
    recommendedMode,
    constraintBudget,
    risks,
    requiredAssets: [...requiredAssets],
    acceptanceChecks: [...acceptanceChecks],
    providerCapabilityStatus: "UNKNOWN",
    providerCapabilityNote: "Confirm that the selected provider supports the recommended route and required assets before dispatch.",
  };
}
