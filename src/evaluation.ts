import { z } from "zod";

const ScoreSchema = z.number().min(0).max(5);

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
}

export function scoreRender(input: unknown): RenderScore {
  const observation = RenderObservationSchema.parse(input);
  const score = Object.entries(weights).reduce((total, [criterion, weight]) => (
    total + observation.scores[criterion as keyof typeof weights] * weight * 20
  ), 0);
  const roundedScore = Math.round(score * 10) / 10;
  const criticalDefects = observation.defects.filter((defect) => defect.severity === "critical").length;
  const grade = criticalDefects > 0 || roundedScore < 60
    ? "blocked"
    : roundedScore < 75
      ? "needs-repair"
      : roundedScore < 90
        ? "production-candidate"
        : "exceptional";

  return { cycleId: observation.cycleId, shotId: observation.shotId, score: roundedScore, grade, criticalDefects };
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
      && current.criticalDefects === 0,
  };
}
