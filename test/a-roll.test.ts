import { describe, expect, it } from "vitest";
import { planARollPostflight } from "../src/index.js";

describe("A-roll post-flight planning", () => {
  it("keeps the returned v0.8.5-like take in manual review while fine lip sync is unknown", () => {
    const plan = planARollPostflight({
      clipDurationSeconds: 8,
      frameRateFps: 24,
      dialogueStatus: "verified",
      identityStatus: "verified",
      lipSyncStatus: "unknown",
      terminalBoundaryStatus: "failed",
      speechEndSeconds: 5.72,
      stableBoundaryStartSeconds: 7,
      lastStableBoundaryFrameSeconds: 7.417,
      measuredIntegratedLufs: -22.59,
      measuredTruePeakDbfs: -2.84,
    });
    expect(plan).toEqual(expect.objectContaining({
      decision: "MANUAL_REVIEW",
      continuationAllowed: false,
      normalizeAudio: true,
      targetIntegratedLufs: -14,
      targetTruePeakDbfsMax: -1,
    }));
    expect(plan.trimEndSeconds).toBeCloseTo(7.4586666667, 9);
  });

  it("salvages a fully verified take when only terminal and mix need deterministic repair", () => {
    const plan = planARollPostflight({
      clipDurationSeconds: 8,
      frameRateFps: 29.97,
      dialogueStatus: "verified",
      identityStatus: "verified",
      lipSyncStatus: "verified",
      terminalBoundaryStatus: "failed",
      speechEndSeconds: 5.72,
      stableBoundaryStartSeconds: 7.2,
      lastStableBoundaryFrameSeconds: 7.4,
      measuredIntegratedLufs: -22.59,
      measuredTruePeakDbfs: -2.84,
    });
    expect(plan).toEqual(expect.objectContaining({
      decision: "SALVAGE_AND_REVIEW",
      continuationAllowed: false,
      normalizeAudio: true,
    }));
    expect(plan.trimEndSeconds).toBeCloseTo(7.4333667000, 9);
  });

  it("regenerates on exact-dialogue or identity failure", () => {
    expect(planARollPostflight({
      clipDurationSeconds: 8,
      dialogueStatus: "failed",
      identityStatus: "verified",
      lipSyncStatus: "verified",
      terminalBoundaryStatus: "passed",
    }).decision).toBe("REGENERATE");
  });

  it("does not salvage a terminal failure without a proven post-speech frame", () => {
    expect(planARollPostflight({
      clipDurationSeconds: 8,
      dialogueStatus: "verified",
      identityStatus: "verified",
      lipSyncStatus: "verified",
      terminalBoundaryStatus: "failed",
      speechEndSeconds: 5.72,
      stableBoundaryStartSeconds: 5.2,
      lastStableBoundaryFrameSeconds: 5.5,
    }).decision).toBe("REGENERATE");
  });

  it("does not mistake one transient closed-mouth frame for a stable continuation boundary", () => {
    const plan = planARollPostflight({
      clipDurationSeconds: 8,
      frameRateFps: 24,
      dialogueStatus: "verified",
      identityStatus: "verified",
      lipSyncStatus: "verified",
      terminalBoundaryStatus: "failed",
      speechEndSeconds: 5.72,
      stableBoundaryStartSeconds: 7.4,
      lastStableBoundaryFrameSeconds: 7.4,
      measuredIntegratedLufs: -14,
      measuredTruePeakDbfs: -1.2,
    });
    expect(plan).toEqual(expect.objectContaining({
      decision: "MANUAL_REVIEW",
      continuationAllowed: false,
      trimEndSeconds: null,
    }));
    expect(plan.reasons.join(" ")).toContain("3 consecutive frames");
  });

  it("accepts exactly three consecutive decoded stable frames", () => {
    const stableBoundaryStartSeconds = 7;
    const plan = planARollPostflight({
      clipDurationSeconds: 8,
      frameRateFps: 24,
      dialogueStatus: "verified",
      identityStatus: "verified",
      lipSyncStatus: "verified",
      terminalBoundaryStatus: "failed",
      speechEndSeconds: 5.72,
      stableBoundaryStartSeconds,
      lastStableBoundaryFrameSeconds: stableBoundaryStartSeconds + (2 / 24),
      measuredIntegratedLufs: -14,
      measuredTruePeakDbfs: -1.2,
    });
    expect(plan).toEqual(expect.objectContaining({
      decision: "SALVAGE_AND_REVIEW",
      continuationAllowed: false,
    }));
    expect(plan.trimEndSeconds).toBeCloseTo(stableBoundaryStartSeconds + (3 / 24), 12);
  });

  it("routes a terminal failure with missing speech-end evidence to manual review", () => {
    const plan = planARollPostflight({
      clipDurationSeconds: 8,
      dialogueStatus: "verified",
      identityStatus: "verified",
      lipSyncStatus: "unknown",
      terminalBoundaryStatus: "failed",
      lastStableBoundaryFrameSeconds: 7.4,
      measuredIntegratedLufs: -14,
      measuredTruePeakDbfs: -1.2,
    });
    expect(plan.decision).toBe("MANUAL_REVIEW");
    expect(plan.requiredReaudit).toEqual(expect.arrayContaining([
      "speech end and consecutive post-speech stable-frame span",
      "fine audiovisual lip sync",
    ]));
  });

  it("does not clamp away the full-frame pad at the end of a clip", () => {
    const plan = planARollPostflight({
      clipDurationSeconds: 8,
      frameRateFps: 24,
      dialogueStatus: "verified",
      identityStatus: "verified",
      lipSyncStatus: "verified",
      terminalBoundaryStatus: "failed",
      stableBoundaryStartSeconds: 7.85,
      speechEndSeconds: 5.72,
      lastStableBoundaryFrameSeconds: 7.99,
      measuredIntegratedLufs: -14,
      measuredTruePeakDbfs: -1.2,
    });
    expect(plan).toEqual(expect.objectContaining({
      decision: "MANUAL_REVIEW",
      continuationAllowed: false,
      trimEndSeconds: null,
    }));
  });

  it("accepts only fully evidenced, in-range results", () => {
    expect(planARollPostflight({
      clipDurationSeconds: 8,
      dialogueStatus: "verified",
      identityStatus: "verified",
      lipSyncStatus: "verified",
      terminalBoundaryStatus: "passed",
      measuredIntegratedLufs: -14.2,
      measuredTruePeakDbfs: -1.2,
    })).toEqual(expect.objectContaining({
      decision: "ACCEPT",
      continuationAllowed: true,
      normalizeAudio: false,
    }));
  });

  it("keeps missing evidence out of continuation", () => {
    expect(planARollPostflight({
      clipDurationSeconds: 8,
      dialogueStatus: "unknown",
      identityStatus: "verified",
      lipSyncStatus: "unknown",
      terminalBoundaryStatus: "passed",
    }).decision).toBe("MANUAL_REVIEW");
  });

  it("does not accept a visually clean take without measured audio evidence", () => {
    expect(planARollPostflight({
      clipDurationSeconds: 8,
      dialogueStatus: "verified",
      identityStatus: "verified",
      lipSyncStatus: "verified",
      terminalBoundaryStatus: "passed",
    })).toEqual(expect.objectContaining({
      decision: "MANUAL_REVIEW",
      continuationAllowed: false,
    }));
  });

  it("reports both missing audio and unknown lip sync in manual review", () => {
    const plan = planARollPostflight({
      clipDurationSeconds: 8,
      dialogueStatus: "verified",
      identityStatus: "verified",
      lipSyncStatus: "unknown",
      terminalBoundaryStatus: "passed",
    });
    expect(plan.decision).toBe("MANUAL_REVIEW");
    expect(plan.requiredReaudit).toEqual(expect.arrayContaining([
      "integrated loudness and true peak",
      "fine audiovisual lip sync",
    ]));
  });
});
