import { z } from "zod";

const EvidenceStatusSchema = z.enum(["passed", "failed", "unknown", "pending"]);
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i, "expected a SHA-256 hex digest");
const BROLL_CONCEALMENT_GUARD = true;

export const SourceClipSchema = z.object({
  id: z.string().min(1),
  sha256: Sha256Schema,
  approvedScript: z.string().trim().min(1),
  observedTranscript: z.string().trim().min(1),
  durationSeconds: z.number().positive(),
  identityStatus: z.enum(["verified", "failed", "unknown"]),
  lipSyncStatus: z.enum(["verified", "failed", "unknown"]),
  dialogueStatus: z.enum(["verified", "failed", "unknown"]),
  terminalStatus: z.enum(["verified", "repairable", "failed", "unknown"]),
  disposition: z.enum(["accepted", "salvage", "regenerate", "manual-review"]),
});

export const PostProductionPlanSchema = z.object({
  schemaVersion: z.literal("auteur-post-production/1.0"),
  projectId: z.string().min(1),
  outputDurationSeconds: z.number().positive(),
  sources: z.array(SourceClipSchema).min(1),
  timeline: z.array(z.object({
    id: z.string().min(1),
    sourceClipId: z.string().min(1),
    timelineStartSeconds: z.number().min(0),
    timelineEndSeconds: z.number().positive(),
    sourceInSeconds: z.number().min(0),
    sourceOutSeconds: z.number().positive(),
    phraseBoundaryStatus: z.enum(["verified", "failed", "unknown"]),
  })).min(1),
  overlays: z.array(z.object({
    id: z.string().min(1),
    text: z.string().trim().min(1),
    meaningUnit: z.string().trim().min(1),
    startSeconds: z.number().min(0),
    endSeconds: z.number().positive(),
    safeAreaStatus: z.enum(["verified", "failed", "unknown"]),
    renderedPixelReview: z.boolean(),
  })).default([]),
  bRoll: z.array(z.object({
    id: z.string().min(1),
    startSeconds: z.number().min(0),
    endSeconds: z.number().positive(),
    sourceKind: z.enum([
      "original-capture",
      "licensed-stock",
      "generated-image-motion",
      "html-canvas-motion",
      "synthetic-3d",
    ]),
    narrativePurpose: z.string().trim().min(12),
    motionIntent: z.string().trim().min(8),
    concealsMaterialARollFailure: z.boolean().default(false),
  })).default([]),
  transitions: z.array(z.object({
    id: z.string().min(1),
    startSeconds: z.number().min(0),
    durationSeconds: z.number().positive().max(2),
    narrativePurpose: z.string().trim().min(12),
  })).default([]),
  picture: z.object({
    frameRateFps: z.number().positive().max(240),
    startsAtZero: z.boolean(),
    fullDecodePassed: z.boolean(),
    colourReferenceSourceId: z.string().min(1),
    colourMatchStatus: z.enum(["verified", "failed", "unknown"]),
  }),
  audio: z.object({
    sampleRateHz: z.number().int().positive(),
    channels: z.number().int().min(1).max(8),
    measuredIntegratedLufs: z.number().min(-70).max(0),
    measuredTruePeakDbtp: z.number().min(-20).max(0),
    targetIntegratedLufs: z.number().min(-70).max(0).default(-16),
    targetTruePeakDbtpMax: z.number().min(-20).max(0).default(-1),
    fullDecodePassed: z.boolean(),
    clockSyncPassed: z.boolean(),
  }),
  delivery: z.object({
    sourceWidth: z.number().int().positive(),
    sourceHeight: z.number().int().positive(),
    outputWidth: z.number().int().positive(),
    outputHeight: z.number().int().positive(),
    resolutionClaim: z.enum(["native", "presentation-upscale", "same-resolution"]),
    comparedToApprovedMaster: z.boolean(),
    audioTrackHashPreserved: z.boolean(),
  }),
  qualityControl: z.object({
    perSecondInspectionCompleted: z.boolean(),
    declaredBoundaryInspectionCompleted: z.boolean(),
    fullSpeedPlaybackCompleted: z.boolean(),
  }),
  reviews: z.object({
    authorSessionId: z.string().min(1),
    authorDeterministic: EvidenceStatusSchema,
    independentReviewerSessionId: z.string().min(1).optional(),
    independentCraft: EvidenceStatusSchema,
    founderAcceptance: EvidenceStatusSchema,
  }),
}).superRefine((plan, ctx) => {
  const sourceIds = new Set<string>();
  const hashes = new Set<string>();
  for (const [index, source] of plan.sources.entries()) {
    if (sourceIds.has(source.id)) {
      ctx.addIssue({ code: "custom", path: ["sources", index, "id"], message: "source id must be unique" });
    }
    if (hashes.has(source.sha256.toLowerCase())) {
      ctx.addIssue({ code: "custom", path: ["sources", index, "sha256"], message: "source hash must be unique" });
    }
    sourceIds.add(source.id);
    hashes.add(source.sha256.toLowerCase());

    const normalizedApproved = normalizeSpeech(source.approvedScript);
    const normalizedObserved = normalizeSpeech(source.observedTranscript);
    const occurrenceCount = countPhraseOccurrences(normalizedObserved, normalizedApproved);
    const materialFailure = source.identityStatus === "failed"
      || source.lipSyncStatus === "failed"
      || source.dialogueStatus === "failed"
      || normalizedObserved !== normalizedApproved
      || occurrenceCount !== 1;
    if (materialFailure && source.disposition !== "regenerate") {
      ctx.addIssue({
        code: "custom",
        path: ["sources", index, "disposition"],
        message: "material identity, lip-sync, dialogue, or repetition failure requires regeneration",
      });
    }
  }

  for (const [index, segment] of plan.timeline.entries()) {
    if (!sourceIds.has(segment.sourceClipId)) {
      ctx.addIssue({ code: "custom", path: ["timeline", index, "sourceClipId"], message: "unknown source clip" });
    }
    if (segment.timelineEndSeconds <= segment.timelineStartSeconds) {
      ctx.addIssue({ code: "custom", path: ["timeline", index], message: "timeline end must follow start" });
    }
    if (segment.sourceOutSeconds <= segment.sourceInSeconds) {
      ctx.addIssue({ code: "custom", path: ["timeline", index], message: "source out must follow in" });
    }
    const source = plan.sources.find((candidate) => candidate.id === segment.sourceClipId);
    if (source && segment.sourceOutSeconds > source.durationSeconds) {
      ctx.addIssue({ code: "custom", path: ["timeline", index, "sourceOutSeconds"], message: "source out exceeds source duration" });
    }
    if (segment.timelineEndSeconds > plan.outputDurationSeconds) {
      ctx.addIssue({ code: "custom", path: ["timeline", index, "timelineEndSeconds"], message: "timeline segment exceeds output duration" });
    }
  }
  for (const [index, overlay] of plan.overlays.entries()) {
    if (overlay.endSeconds <= overlay.startSeconds) {
      ctx.addIssue({ code: "custom", path: ["overlays", index], message: "overlay end must follow start" });
    }
    if (overlay.endSeconds > plan.outputDurationSeconds) {
      ctx.addIssue({ code: "custom", path: ["overlays", index, "endSeconds"], message: "overlay exceeds output duration" });
    }
  }
  for (const [index, shot] of plan.bRoll.entries()) {
    if (shot.endSeconds <= shot.startSeconds) {
      ctx.addIssue({ code: "custom", path: ["bRoll", index], message: "B-roll end must follow start" });
    }
    if (shot.endSeconds > plan.outputDurationSeconds) {
      ctx.addIssue({ code: "custom", path: ["bRoll", index, "endSeconds"], message: "B-roll exceeds output duration" });
    }
    if (BROLL_CONCEALMENT_GUARD && shot.concealsMaterialARollFailure) {
      ctx.addIssue({
        code: "custom",
        path: ["bRoll", index, "concealsMaterialARollFailure"],
        message: "B-roll must not conceal a material A-roll identity, dialogue, or lip-sync failure",
      });
    }
  }
  for (const [index, transition] of plan.transitions.entries()) {
    if (transition.startSeconds + transition.durationSeconds > plan.outputDurationSeconds) {
      ctx.addIssue({ code: "custom", path: ["transitions", index], message: "transition exceeds output duration" });
    }
  }
  if (!sourceIds.has(plan.picture.colourReferenceSourceId)) {
    ctx.addIssue({
      code: "custom",
      path: ["picture", "colourReferenceSourceId"],
      message: "colour reference must identify a declared source clip",
    });
  }
  if (
    plan.delivery.outputWidth > plan.delivery.sourceWidth
    || plan.delivery.outputHeight > plan.delivery.sourceHeight
  ) {
    if (plan.delivery.resolutionClaim !== "presentation-upscale") {
      ctx.addIssue({
        code: "custom",
        path: ["delivery", "resolutionClaim"],
        message: "an enlarged delivery must be labeled presentation-upscale, never native detail",
      });
    }
  }
  const reviewer = plan.reviews.independentReviewerSessionId;
  if (reviewer && reviewer === plan.reviews.authorSessionId) {
    ctx.addIssue({
      code: "custom",
      path: ["reviews", "independentReviewerSessionId"],
      message: "independent reviewer session must differ from author session",
    });
  }
});

export type PostProductionPlan = z.infer<typeof PostProductionPlanSchema>;

export interface PostProductionAudit {
  deterministicIntegrity: "PASS" | "FAIL";
  releaseDecision: "ACCEPT" | "REVISE" | "REGENERATE_SOURCE" | "REVIEW_PENDING";
  issues: string[];
  requiredActions: string[];
}

function normalizeSpeech(value: string): string {
  return value.toLocaleLowerCase("en-CA")
    .replace(/[^\p{L}\p{N}'’]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countPhraseOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  while (offset <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, offset);
    if (index < 0) break;
    count += 1;
    offset = index + needle.length;
  }
  return count;
}

export function auditPostProductionPlan(input: unknown): PostProductionAudit {
  const plan = PostProductionPlanSchema.parse(input);
  const issues: string[] = [];
  const requiredActions: string[] = [];

  const regenerate = plan.sources.filter((source) => source.disposition === "regenerate");
  if (regenerate.length) {
    issues.push(`source regeneration required: ${regenerate.map((source) => source.id).join(", ")}`);
    requiredActions.push("regenerate material A-roll failures before editorial assembly");
  }
  const unknownSources = plan.sources.filter((source) => (
    source.disposition === "manual-review"
    || source.identityStatus === "unknown"
    || source.lipSyncStatus === "unknown"
    || source.dialogueStatus === "unknown"
    || source.terminalStatus === "unknown"
  ));
  if (unknownSources.length) {
    issues.push(`source evidence incomplete: ${unknownSources.map((source) => source.id).join(", ")}`);
    requiredActions.push("complete perceptual source review");
  }
  if (plan.timeline.some((segment) => segment.phraseBoundaryStatus !== "verified")) {
    issues.push("one or more editorial cuts lack a verified phrase boundary");
    requiredActions.push("repair or verify phrase-safe trims");
  }
  if (plan.overlays.some((overlay) => overlay.safeAreaStatus !== "verified" || !overlay.renderedPixelReview)) {
    issues.push("one or more overlays lack rendered-pixel and safe-area approval");
    requiredActions.push("inspect every overlay at output resolution, not only in a contact sheet");
  }
  if (!plan.picture.startsAtZero || !plan.picture.fullDecodePassed || plan.picture.colourMatchStatus !== "verified") {
    issues.push("picture clock, decode, or colour-match proof is incomplete");
    requiredActions.push("rerun picture technical and colour gates");
  }
  if (
    plan.audio.sampleRateHz !== 48_000
    || plan.audio.channels !== 2
    || !plan.audio.fullDecodePassed
    || !plan.audio.clockSyncPassed
    || Math.abs(plan.audio.measuredIntegratedLufs - plan.audio.targetIntegratedLufs) > 1
    || plan.audio.measuredTruePeakDbtp > plan.audio.targetTruePeakDbtpMax + 0.1
  ) {
    issues.push("audio delivery is outside the declared 48 kHz stereo, loudness, peak, decode, or clock contract");
    requiredActions.push("master and remeasure the final audio stream");
  }
  if (
    !plan.delivery.comparedToApprovedMaster
    || !plan.delivery.audioTrackHashPreserved
  ) {
    issues.push("delivery has not been compared to the approved master with audio identity preserved");
    requiredActions.push("compare delivery against the approved master and verify audio hash");
  }
  if (
    !plan.qualityControl.perSecondInspectionCompleted
    || !plan.qualityControl.declaredBoundaryInspectionCompleted
    || !plan.qualityControl.fullSpeedPlaybackCompleted
  ) {
    issues.push("frame sampling, boundary inspection, or full-speed playback is incomplete");
    requiredActions.push("complete per-second, boundary, and full-speed human review");
  }

  const deterministicIntegrity = issues.length === 0 ? "PASS" : "FAIL";
  if (regenerate.length) {
    return { deterministicIntegrity, releaseDecision: "REGENERATE_SOURCE", issues, requiredActions };
  }
  if (deterministicIntegrity === "FAIL" || plan.reviews.founderAcceptance === "failed" || plan.reviews.independentCraft === "failed") {
    return { deterministicIntegrity, releaseDecision: "REVISE", issues, requiredActions };
  }
  if (
    plan.reviews.authorDeterministic !== "passed"
    || plan.reviews.independentCraft !== "passed"
    || plan.reviews.founderAcceptance !== "passed"
  ) {
    return {
      deterministicIntegrity,
      releaseDecision: "REVIEW_PENDING",
      issues: [...issues, "machine integrity, independent craft review, and founder acceptance are separate gates"],
      requiredActions: [...requiredActions, "obtain every missing review without self-review"],
    };
  }
  return { deterministicIntegrity, releaseDecision: "ACCEPT", issues, requiredActions };
}
