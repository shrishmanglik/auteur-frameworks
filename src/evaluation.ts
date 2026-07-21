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

export interface RenderScore {
  cycleId: string;
  shotId: string;
  score: number;
  grade: "blocked" | "needs-repair" | "production-candidate" | "exceptional";
  criticalDefects: number;
  audioGate: {
    expectation: "exact-speech" | "no-speech" | "nonverbal" | null;
    status: "verified" | "failed" | "not-run";
    method: string | null;
    evidence: string | null;
    qualityAccepted: boolean;
    minimumRubricScore: 3;
  };
}

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
