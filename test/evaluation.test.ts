import { describe, expect, it } from "vitest";
import {
  buildEvidenceReceipt,
  compareRenderCycles,
  EvidenceReceiptSchema,
  scoreRender,
} from "../src/index.js";

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
  audioVerification: {
    expectation: "nonverbal" as const,
    status: "verified" as const,
    method: "Synthetic audio inspection",
    evidence: "The synthetic fixture satisfies its nonverbal audio contract.",
  },
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

  it("never passes a blocked result even when the numeric score improves", () => {
    const blocked = structuredClone(observation);
    blocked.cycleId = "cycle-blocked";
    blocked.scores.promptAdherence = 5;
    blocked.scores.temporalCompletion = 5;
    blocked.defects = [{ severity: "critical" as const, description: "The hero object disappears." }];
    const comparison = compareRenderCycles(observation, blocked);
    expect(comparison.relativeImprovementPercent).toBeGreaterThanOrEqual(10);
    expect(scoreRender(blocked).grade).toBe("blocked");
    expect(comparison.meetsTenPercentThreshold).toBe(false);
  });

  it("withholds production acceptance when audio evidence was not run", () => {
    const highScore = {
      ...structuredClone(observation),
      audioVerification: undefined,
    };
    for (const key of Object.keys(highScore.scores) as Array<keyof typeof highScore.scores>) {
      highScore.scores[key] = 5;
    }

    expect(scoreRender(highScore)).toMatchObject({
      score: 100,
      grade: "needs-repair",
      audioGate: { status: "not-run", expectation: null },
    });
  });

  it("normalizes an explicit not-run state without fake method or evidence", () => {
    const notRun = {
      ...structuredClone(observation),
      audioVerification: {
        expectation: "no-speech" as const,
        status: "not-run" as const,
      },
    };

    expect(scoreRender(notRun).audioGate).toMatchObject({
      expectation: "no-speech",
      status: "not-run",
      method: null,
      evidence: null,
      qualityAccepted: false,
    });
  });

  it("accepts a high-scoring nonverbal render only with explicit audio evidence", () => {
    const verified = structuredClone(observation);
    for (const key of Object.keys(verified.scores) as Array<keyof typeof verified.scores>) {
      verified.scores[key] = 5;
    }
    verified.audioVerification = {
      expectation: "nonverbal" as const,
      status: "verified" as const,
      method: "VAD-enabled speech scan plus waveform and spectrum inspection",
      evidence: "No speech segments; one trumpet note decays before the final chair transient.",
    };

    expect(scoreRender(verified)).toMatchObject({
      score: 100,
      grade: "exceptional",
      criticalDefects: 0,
      audioGate: { status: "verified", expectation: "nonverbal" },
    });
  });

  it("blocks a render when required no-speech verification fails", () => {
    const failed = structuredClone(observation);
    for (const key of Object.keys(failed.scores) as Array<keyof typeof failed.scores>) {
      failed.scores[key] = 5;
    }
    failed.audioVerification = {
      expectation: "no-speech" as const,
      status: "failed" as const,
      method: "VAD-enabled local transcription",
      evidence: "A spoken sentence was recovered from the returned media.",
    };

    expect(scoreRender(failed)).toMatchObject({
      score: 100,
      grade: "blocked",
      criticalDefects: 1,
      audioGate: { status: "failed", expectation: "no-speech" },
    });
  });

  it("rejects contradictory verified audio with an unusable audio score", () => {
    const contradictory = structuredClone(observation);
    contradictory.cycleId = "cycle-contradictory";
    for (const key of Object.keys(contradictory.scores) as Array<keyof typeof contradictory.scores>) {
      contradictory.scores[key] = 5;
    }
    contradictory.scores.audio = 0;
    contradictory.audioVerification = {
      expectation: "exact-speech" as const,
      status: "verified" as const,
      method: "VAD-enabled local transcription",
      evidence: "The requested sentence was recovered exactly once.",
    };

    const scored = scoreRender(contradictory);
    const comparison = compareRenderCycles(observation, contradictory);
    expect(scored).toMatchObject({
      score: 90,
      grade: "needs-repair",
      audioGate: {
        status: "verified",
        qualityAccepted: false,
        minimumRubricScore: 3,
      },
    });
    expect(comparison.relativeImprovementPercent).toBe(50);
    expect(comparison.meetsTenPercentThreshold).toBe(false);
  });

  it("builds a typed evidence receipt that explains what changed and why", () => {
    const receipt = buildEvidenceReceipt({
      observation,
      reviewMode: "human-and-vision-assisted",
      promptFingerprint: { algorithm: "sha256", value: "A".repeat(64) },
      mediaFingerprint: { algorithm: "sha256", value: "b".repeat(64) },
      decision: "repair",
      reasons: ["The render completed the action but did not clear the acceptance threshold."],
      changes: [{
        field: "temporalCompletion",
        before: "The action stopped before contact.",
        after: "The primary action completes.",
        assessment: "improved",
        reason: "The repair added a visible source-to-destination bridge.",
        evidence: "Frame review confirms contact before the final beat.",
      }],
      limitations: ["Synthetic fixture; no provider capability is claimed."],
    });

    expect(receipt).toMatchObject({
      receiptVersion: "1.0.0",
      shotId: "shot-1",
      failureState: "repair-required",
      decision: "repair",
      evaluation: { score: 60, grade: "needs-repair" },
      changes: [{
        field: "temporalCompletion",
        assessment: "improved",
      }],
    });
    expect(receipt.promptFingerprint.value).toBe("a".repeat(64));
    expect(EvidenceReceiptSchema.parse(receipt)).toEqual(receipt);
  });

  it("rejects an acceptance receipt when deterministic gates have not cleared", () => {
    expect(() => buildEvidenceReceipt({
      observation,
      reviewMode: "human",
      promptFingerprint: { algorithm: "sha256", value: "a".repeat(64) },
      mediaFingerprint: { algorithm: "sha256", value: "b".repeat(64) },
      decision: "accept",
      reasons: ["A reviewer requested acceptance."],
      limitations: ["Synthetic fixture; no provider capability is claimed."],
    })).toThrow("deterministic score and audio gates");
  });

  it("rejects evidence receipts without valid content fingerprints", () => {
    expect(() => buildEvidenceReceipt({
      observation,
      reviewMode: "vision-assisted",
      promptFingerprint: { algorithm: "sha256", value: "not-a-sha256" },
      mediaFingerprint: { algorithm: "sha256", value: "b".repeat(64) },
      decision: "manual-review",
      reasons: ["The prompt fingerprint is malformed."],
      limitations: ["Synthetic fixture; no provider capability is claimed."],
    })).toThrow("SHA-256 fingerprint");
  });

  const receiptInput = (
    renderObservation: typeof observation,
    decision: "accept" | "repair" | "regenerate" | "manual-review" | "salvage-and-reaudit",
  ) => ({
    observation: renderObservation,
    reviewMode: "human" as const,
    promptFingerprint: { algorithm: "sha256" as const, value: "a".repeat(64) },
    mediaFingerprint: { algorithm: "sha256" as const, value: "b".repeat(64) },
    decision,
    reasons: [`The post-flight decision is ${decision}.`],
    limitations: ["Synthetic fixture; no provider capability is claimed."],
  });

  const highScoreObservation = () => {
    const result = structuredClone(observation);
    for (const key of Object.keys(result.scores) as Array<keyof typeof result.scores>) {
      result.scores[key] = 5;
    }
    return result;
  };

  it.each([
    ["accept", "none"],
    ["repair", "repair-required"],
    ["regenerate", "regeneration-required"],
    ["manual-review", "manual-review-required"],
    ["salvage-and-reaudit", "salvage-pending-reaudit"],
  ] as const)("maps the %s decision to the %s state", (decision, expectedState) => {
    const candidate = decision === "repair" ? structuredClone(observation) : highScoreObservation();
    expect(buildEvidenceReceipt(receiptInput(candidate, decision)).failureState).toBe(expectedState);
  });

  it.each([
    [
      "critical-defect",
      () => {
        const result = highScoreObservation();
        result.defects = [{ severity: "critical" as const, description: "The hero object disappears." }];
        return result;
      },
    ],
    [
      "audio-evidence-missing",
      () => {
        const result = highScoreObservation();
        result.audioVerification = undefined;
        return result;
      },
    ],
    [
      "below-acceptance-threshold",
      () => {
        const result = structuredClone(observation);
        for (const key of Object.keys(result.scores) as Array<keyof typeof result.scores>) {
          result.scores[key] = key === "audio" ? 3 : 2;
        }
        return result;
      },
    ],
  ] as const)("makes the %s failure state reachable", (expectedState, makeObservation) => {
    expect(buildEvidenceReceipt(receiptInput(makeObservation(), "repair")).failureState).toBe(expectedState);
  });

  it("requires every receipt to state at least one claim limitation", () => {
    const withoutLimitations = receiptInput(highScoreObservation(), "accept");
    Reflect.deleteProperty(withoutLimitations, "limitations");
    expect(() => buildEvidenceReceipt(withoutLimitations)).toThrow();
  });

  it.each([
    [],
    ["short"],
  ])("rejects invalid limitations through the public receipt schema", (limitations) => {
    const validReceipt = buildEvidenceReceipt(receiptInput(highScoreObservation(), "accept"));
    expect(() => EvidenceReceiptSchema.parse({
      ...validReceipt,
      limitations,
    })).toThrow();
  });

  it("rejects change evidence when both before and after are absent", () => {
    expect(() => buildEvidenceReceipt({
      ...receiptInput(observation, "repair"),
      changes: [{
        field: "continuity",
        before: null,
        after: null,
        assessment: "improved",
        reason: "No values were recorded.",
        evidence: "No comparison evidence exists.",
      }],
    })).toThrow("at least one before or after value");
  });

  it.each([
    ["added", null, "A continuity lock was added."],
    ["removed", "An invalid continuity lock.", null],
    ["changed", "The action stops early.", "The action reaches contact."],
  ] as const)("accepts a valid %s field-level change", (_kind, before, after) => {
    const receipt = buildEvidenceReceipt({
      ...receiptInput(observation, "repair"),
      changes: [{
        field: "continuity",
        before,
        after,
        assessment: "improved",
        reason: "The repair changed only the rejected condition.",
        evidence: "Frame review records the bounded difference.",
      }],
    });
    expect(receipt.changes).toHaveLength(1);
  });
});
