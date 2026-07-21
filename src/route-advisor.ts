import { ShotSchema, type GenerationRiskCode, type Shot } from "./schemas.js";

export type RouteRiskLevel = "low" | "medium" | "high";
export type GenerationMode = "text-only" | "reference-first" | "first-last-frame" | "split-pass";

export type RouteRiskCode = GenerationRiskCode;

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
  risks: RouteRisk[];
  requiredAssets: string[];
  acceptanceChecks: string[];
  providerCapabilityStatus: "UNKNOWN";
  providerCapabilityNote: string;
}

const contains = (text: string, pattern: RegExp): boolean => pattern.test(text);

export function assessShotRoute(input: Shot): ShotRouteAdvice {
  const shot = ShotSchema.parse(input);
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
    /\b(?:cap|lid|component|part|module|piece)\b[^.]{0,96}\b(?:assembles?|assembled|seats|seated|seating|inserts?|inserted|attaches?|attached|detaches?|detached|lowers?|lowered)\b|\b(?:assembles?|assembled|inserts?|inserted|attaches?|attached|detaches?|detached)\b[^.]{0,96}\b(?:cap|lid|component|part|module|piece)\b/,
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

  const riskLevel: RouteRiskLevel = risks.some((risk) => risk.level === "high")
    ? "high"
    : risks.length
      ? "medium"
      : "low";
  const codes = new Set(risks.map((risk) => risk.code));
  const recommendedMode: GenerationMode = codes.has("EXACT_FLUID_COUNT")
    ? "split-pass"
    : codes.has("PRECISE_MECHANICAL_ASSEMBLY") || codes.has("CAUSAL_CONTACT_CHOREOGRAPHY")
      ? "first-last-frame"
      : codes.has("BRAND_OR_TEXT_CONTROL") || codes.has("IDENTITY_OR_PERFORMANCE") || codes.has("TRANSFORMATION_PHASES")
        ? "reference-first"
        : "text-only";

  return {
    shotId: shot.id,
    riskLevel,
    recommendedMode,
    risks,
    requiredAssets: [...requiredAssets],
    acceptanceChecks: [...acceptanceChecks],
    providerCapabilityStatus: "UNKNOWN",
    providerCapabilityNote: "Confirm that the selected provider supports the recommended reference workflow before dispatch.",
  };
}
