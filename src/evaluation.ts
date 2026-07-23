import { z } from "zod";

const ScoreSchema = z.number().min(0).max(5);

const AudioExpectationSchema = z.enum(["exact-speech", "no-speech", "nonverbal"]);

export const AudioVerificationSchema = z.discriminatedUnion("status", [
  z.object({
    expectation: AudioExpectationSchema,
    status: z.literal("verified"),
    method: z.string().min(3),
    evidence: z.string().min(8),
  }),
  z.object({
    expectation: AudioExpectationSchema,
    status: z.literal("failed"),
    method: z.string().min(3),
    evidence: z.string().min(8),
  }),
  z.object({
    expectation: AudioExpectationSchema,
    status: z.literal("not-run"),
    method: z.null().optional(),
    evidence: z.null().optional(),
  }),
]);

export const RenderObservationSchema = z.object({
  cycleId: z.string().min(1),
  packetVersion: z.string().min(1),
  shotId: z.string().min(1),
  provider: z.string().min(1),
  modelLabel: z.string().min(1),
  scores: z.object({
    promptAdherence: ScoreSchema,
    temporalCompletion: ScoreSchema,
    continuity: ScoreSchema,
    physicalMaterialRealism: ScoreSchema,
    cinematography: ScoreSchema,
    audio: ScoreSchema,
  }),
  strengths: z.array(z.string().min(1)).default([]),
  defects: z.array(z.object({
    severity: z.enum(["minor", "major", "critical"]),
    description: z.string().min(1),
    timecode: z.string().min(1).optional(),
  })).default([]),
  audioVerification: AudioVerificationSchema.optional(),
  evidenceNote: z.string().min(1),
});

export type RenderObservation = z.infer<typeof RenderObservationSchema>;

const weights = {
  promptAdherence: 0.2,
  temporalCompletion: 0.2,
  continuity: 0.15,
  physicalMaterialRealism: 0.2,
  cinematography: 0.15,
  audio: 0.1,
} as const;

export const RenderScoreSchema = z.object({
  cycleId: z.string().min(1),
  shotId: z.string().min(1),
  score: z.number().min(0).max(100),
  grade: z.enum(["blocked", "needs-repair", "production-candidate", "exceptional"]),
  criticalDefects: z.number().int().nonnegative(),
  audioGate: z.object({
    expectation: AudioExpectationSchema.nullable(),
    status: z.enum(["verified", "failed", "not-run"]),
    method: z.string().nullable(),
    evidence: z.string().nullable(),
    qualityAccepted: z.boolean(),
    minimumRubricScore: z.literal(3),
  }),
});

export type RenderScore = z.infer<typeof RenderScoreSchema>;

export function scoreRender(input: unknown): RenderScore {
  const observation = RenderObservationSchema.parse(input);
  const score = Object.entries(weights).reduce((total, [criterion, weight]) => (
    total + observation.scores[criterion as keyof typeof weights] * weight * 20
  ), 0);
  const roundedScore = Math.round(score * 10) / 10;
  const audioGate = observation.audioVerification
    ? {
        expectation: observation.audioVerification.expectation,
        status: observation.audioVerification.status,
        method: observation.audioVerification.method ?? null,
        evidence: observation.audioVerification.evidence ?? null,
        qualityAccepted: observation.audioVerification.status === "verified" && observation.scores.audio >= 3,
        minimumRubricScore: 3 as const,
      }
    : {
        expectation: null,
        status: "not-run" as const,
        method: null,
        evidence: null,
        qualityAccepted: false,
        minimumRubricScore: 3 as const,
      };
  const criticalDefects = observation.defects.filter((defect) => defect.severity === "critical").length
    + (audioGate.status === "failed" ? 1 : 0);
  const rubricGrade = criticalDefects > 0 || roundedScore < 60
    ? "blocked"
    : roundedScore < 75
      ? "needs-repair"
      : roundedScore < 90
        ? "production-candidate"
        : "exceptional";
  const grade = !audioGate.qualityAccepted && (rubricGrade === "production-candidate" || rubricGrade === "exceptional")
    ? "needs-repair"
    : rubricGrade;

  return { cycleId: observation.cycleId, shotId: observation.shotId, score: roundedScore, grade, criticalDefects, audioGate };
}

export interface RenderCycleComparison {
  shotId: string;
  previousScore: number;
  currentScore: number;
  absoluteGain: number;
  relativeImprovementPercent: number | null;
  meetsTenPercentThreshold: boolean;
}

export function compareRenderCycles(previousInput: unknown, currentInput: unknown): RenderCycleComparison {
  const previous = scoreRender(previousInput);
  const current = scoreRender(currentInput);
  if (previous.shotId !== current.shotId) {
    throw new Error("Render cycles must evaluate the same shotId.");
  }
  const absoluteGain = Math.round((current.score - previous.score) * 10) / 10;
  const relativeImprovementPercent = previous.score === 0
    ? null
    : Math.round(((current.score - previous.score) / previous.score) * 1000) / 10;

  return {
    shotId: current.shotId,
    previousScore: previous.score,
    currentScore: current.score,
    absoluteGain,
    relativeImprovementPercent,
    meetsTenPercentThreshold: relativeImprovementPercent !== null
      && relativeImprovementPercent >= 10
      && current.grade !== "blocked"
      && current.criticalDefects === 0
      && current.audioGate.qualityAccepted,
  };
}

export const EvidenceFingerprintSchema = z.object({
  algorithm: z.literal("sha256"),
  value: z.string().regex(/^[a-f0-9]{64}$/i, "Expected a 64-character SHA-256 fingerprint.")
    .transform((value) => value.toLowerCase()),
});

export const EvidenceReceiptChangeSchema = z.object({
  field: z.string().min(1),
  before: z.string().nullable(),
  after: z.string().nullable(),
  assessment: z.enum(["improved", "regressed", "unchanged", "unknown"]),
  reason: z.string().min(1),
  evidence: z.string().min(1),
}).refine(
  (change) => change.before !== null || change.after !== null,
  { message: "A change must record at least one before or after value." },
);

export const EvidenceReceiptInputSchema = z.object({
  observation: RenderObservationSchema,
  reviewMode: z.enum(["human", "vision-assisted", "human-and-vision-assisted"]),
  promptFingerprint: EvidenceFingerprintSchema,
  mediaFingerprint: EvidenceFingerprintSchema,
  decision: z.enum(["accept", "repair", "regenerate", "manual-review", "salvage-and-reaudit"]),
  reasons: z.array(z.string().min(1)).min(1),
  changes: z.array(EvidenceReceiptChangeSchema).default([]),
  limitations: z.array(z.string().min(8)).min(1),
});

export type EvidenceReceiptInput = z.infer<typeof EvidenceReceiptInputSchema>;

export const EvidenceReceiptSchema = z.object({
  receiptVersion: z.literal("1.0.0"),
  cycleId: z.string().min(1),
  packetVersion: z.string().min(1),
  shotId: z.string().min(1),
  provider: z.string().min(1),
  modelLabel: z.string().min(1),
  reviewMode: EvidenceReceiptInputSchema.shape.reviewMode,
  promptFingerprint: EvidenceFingerprintSchema,
  mediaFingerprint: EvidenceFingerprintSchema,
  evaluation: RenderScoreSchema,
  failureState: z.enum([
    "none",
    "critical-defect",
    "audio-evidence-missing",
    "below-acceptance-threshold",
    "repair-required",
    "regeneration-required",
    "manual-review-required",
    "salvage-pending-reaudit",
  ]),
  decision: EvidenceReceiptInputSchema.shape.decision,
  reasons: z.array(z.string().min(1)).min(1),
  changes: z.array(EvidenceReceiptChangeSchema),
  evidenceNote: z.string().min(1),
  limitations: z.array(z.string().min(8)).min(1),
});

export type EvidenceReceipt = z.infer<typeof EvidenceReceiptSchema>;

function resolveFailureState(
  evaluation: RenderScore,
  decision: EvidenceReceiptInput["decision"],
): EvidenceReceipt["failureState"] {
  if (evaluation.criticalDefects > 0) return "critical-defect";
  if (evaluation.grade === "blocked") return "below-acceptance-threshold";
  if (decision === "regenerate") return "regeneration-required";
  if (decision === "manual-review") return "manual-review-required";
  if (decision === "salvage-and-reaudit") return "salvage-pending-reaudit";
  if (!evaluation.audioGate.qualityAccepted) return "audio-evidence-missing";
  if (decision === "repair" || evaluation.grade === "needs-repair") return "repair-required";
  return "none";
}

export function buildEvidenceReceipt(input: unknown): EvidenceReceipt {
  const parsed = EvidenceReceiptInputSchema.parse(input);
  const evaluation = scoreRender(parsed.observation);
  if (
    parsed.decision === "accept"
    && (evaluation.grade === "blocked"
      || evaluation.grade === "needs-repair"
      || !evaluation.audioGate.qualityAccepted)
  ) {
    throw new Error("Cannot accept a render that has not cleared deterministic score and audio gates.");
  }

  return EvidenceReceiptSchema.parse({
    receiptVersion: "1.0.0",
    cycleId: parsed.observation.cycleId,
    packetVersion: parsed.observation.packetVersion,
    shotId: parsed.observation.shotId,
    provider: parsed.observation.provider,
    modelLabel: parsed.observation.modelLabel,
    reviewMode: parsed.reviewMode,
    promptFingerprint: parsed.promptFingerprint,
    mediaFingerprint: parsed.mediaFingerprint,
    evaluation,
    failureState: resolveFailureState(evaluation, parsed.decision),
    decision: parsed.decision,
    reasons: parsed.reasons,
    changes: parsed.changes,
    evidenceNote: parsed.observation.evidenceNote,
    limitations: parsed.limitations,
  });
}
