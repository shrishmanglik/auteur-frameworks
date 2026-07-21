import { describe, expect, it } from "vitest";
import { compareRenderCycles, scoreRender } from "../src/index.js";

const observation = {
  cycleId: "cycle-1",
  packetVersion: "1.0.0",
  shotId: "shot-1",
  provider: "provider-observed-at-runtime",
  modelLabel: "model-observed-at-runtime",
  scores: {
    promptAdherence: 3,
    temporalCompletion: 3,
    continuity: 3,
    physicalMaterialRealism: 3,
    cinematography: 3,
    audio: 3,
  },
  strengths: ["The primary action completes."],
  defects: [],
  evidenceNote: "Synthetic test observation; not a provider claim.",
};

describe("render evaluation", () => {
  it("scores the weighted rubric on a 100-point scale", () => {
    expect(scoreRender(observation)).toMatchObject({ score: 60, grade: "needs-repair" });
  });

  it("requires a relative ten-percent gain for a successful refinement", () => {
    const improved = structuredClone(observation);
    improved.cycleId = "cycle-2";
    improved.scores.promptAdherence = 4;
    improved.scores.temporalCompletion = 4;
    improved.scores.physicalMaterialRealism = 4;
    const comparison = compareRenderCycles(observation, improved);
    expect(comparison.relativeImprovementPercent).toBe(20);
    expect(comparison.meetsTenPercentThreshold).toBe(true);
  });

  it("rejects comparisons across different shots", () => {
    const otherShot = { ...observation, shotId: "shot-2" };
    expect(() => compareRenderCycles(observation, otherShot)).toThrow("same shotId");
  });
});
