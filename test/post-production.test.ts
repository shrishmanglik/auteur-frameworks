import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { auditPostProductionPlan, PostProductionPlanSchema } from "../src/index.js";

const clean = JSON.parse(readFileSync("examples/post-production-plan.json", "utf8"));
const clone = () => structuredClone(clean);

describe("post-production contract", () => {
  it("accepts only a fully evidenced edit with separate author, reviewer, and founder gates", () => {
    expect(auditPostProductionPlan(clean)).toEqual({
      deterministicIntegrity: "PASS",
      releaseDecision: "ACCEPT",
      issues: [],
      requiredActions: [],
    });
  });

  it("rejects a repeated approved phrase hidden inside an accepted source", () => {
    const bad = clone();
    bad.sources[0].observedTranscript += ` ${bad.sources[0].approvedScript}`;
    expect(() => PostProductionPlanSchema.parse(bad)).toThrow(/repetition failure requires regeneration/);
  });

  it("rejects extra spoken words even when a supplied status claims dialogue passed", () => {
    const bad = clone();
    bad.sources[0].observedTranscript += " extra words";
    expect(() => PostProductionPlanSchema.parse(bad)).toThrow(/dialogue, or repetition failure/);
  });

  it("rejects B-roll used to conceal a material A-roll failure", () => {
    const bad = clone();
    bad.bRoll[0].concealsMaterialARollFailure = true;
    expect(() => PostProductionPlanSchema.parse(bad)).toThrow(/must not conceal/);
  });

  it("rejects a false native-resolution claim for an upscale", () => {
    const bad = clone();
    bad.delivery.resolutionClaim = "native";
    expect(() => PostProductionPlanSchema.parse(bad)).toThrow(/presentation-upscale/);
  });

  it("rejects self-review", () => {
    const bad = clone();
    bad.reviews.independentReviewerSessionId = bad.reviews.authorSessionId;
    expect(() => PostProductionPlanSchema.parse(bad)).toThrow(/must differ from author/);
  });

  it("rejects an independent pass with no reviewer identity", () => {
    const bad = clone();
    delete bad.reviews.independentReviewerSessionId;
    expect(() => PostProductionPlanSchema.parse(bad)).toThrow(/requires a different reviewer/);
  });

  it("rejects a failed terminal state mislabeled as accepted", () => {
    const bad = clone();
    bad.sources[0].terminalStatus = "failed";
    bad.sources[0].disposition = "accepted";
    expect(() => PostProductionPlanSchema.parse(bad)).toThrow(/requires regeneration/);
  });

  it("rejects overlapping A-roll timeline segments", () => {
    const bad = clone();
    bad.timeline.push({
      id: "segment-02",
      sourceClipId: "clip-01",
      timelineStartSeconds: 5.2,
      timelineEndSeconds: 5.4,
      sourceInSeconds: 5.2,
      sourceOutSeconds: 5.4,
      phraseBoundaryStatus: "verified",
    });
    expect(() => PostProductionPlanSchema.parse(bad)).toThrow(/timeline overlaps/);
  });

  it("rejects missing colour source and out-of-range timeline references", () => {
    const badColour = clone();
    badColour.picture.colourReferenceSourceId = "missing";
    expect(() => PostProductionPlanSchema.parse(badColour)).toThrow(/colour reference/);

    const badTimeline = clone();
    badTimeline.timeline[0].sourceOutSeconds = 99;
    expect(() => PostProductionPlanSchema.parse(badTimeline)).toThrow(/source duration/);
  });

  it("fails deterministic integrity when overlay pixels were not inspected", () => {
    const bad = clone();
    bad.overlays[0].renderedPixelReview = false;
    expect(auditPostProductionPlan(bad)).toEqual(expect.objectContaining({
      deterministicIntegrity: "FAIL",
      releaseDecision: "REVISE",
    }));
  });

  it("keeps machine integrity separate from founder acceptance", () => {
    const rejected = clone();
    rejected.reviews.founderAcceptance = "failed";
    expect(auditPostProductionPlan(rejected)).toEqual(expect.objectContaining({
      deterministicIntegrity: "PASS",
      releaseDecision: "REVISE",
    }));

    const pending = clone();
    pending.reviews.independentCraft = "pending";
    expect(auditPostProductionPlan(pending)).toEqual(expect.objectContaining({
      deterministicIntegrity: "PASS",
      releaseDecision: "REVIEW_PENDING",
    }));
  });

  it("routes material lip-sync failure to source regeneration", () => {
    const bad = clone();
    bad.sources[0].lipSyncStatus = "failed";
    bad.sources[0].disposition = "regenerate";
    expect(auditPostProductionPlan(bad)).toEqual(expect.objectContaining({
      releaseDecision: "REGENERATE_SOURCE",
    }));
  });
});
