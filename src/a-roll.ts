import { z } from "zod";

export const A_ROLL_CONTRACT_DEFAULTS = {
  frameRateFps: 24,
  freezePadFramesAtEnd: 3,
  lipSyncConfidenceMin: 0.99,
  minimumTerminalSettleSeconds: 0.75,
  terminalBoundaryLockSeconds: 0.25,
  minimumStableBoundaryFrames: 3,
  speechTimingSlackMultiplier: 1.08,
} as const;

export interface ARollSpeechWindowInput {
  spokenText: string;
  paceWpm: number;
  speechRateTolerancePercent?: number;
  shotDurationSeconds: number;
  startSeconds?: number;
}

export interface ARollSpeechWindowPlan {
  wordCount: number;
  nominalDurationSeconds: number;
  plannedDurationSeconds: number;
  speechRateTolerancePercent: number;
  startSeconds: number;
  endSeconds: number;
  terminalSettleSeconds: number;
}

export function planARollSpeechWindow(input: ARollSpeechWindowInput): ARollSpeechWindowPlan {
  const spokenText = input.spokenText.trim();
  if (!spokenText) throw new Error("A-roll speech planning requires non-empty spokenText.");
  if (!Number.isFinite(input.paceWpm) || input.paceWpm < 60 || input.paceWpm > 240) {
    throw new Error("A-roll paceWpm must be between 60 and 240.");
  }
  if (!Number.isFinite(input.shotDurationSeconds) || input.shotDurationSeconds <= 0) {
    throw new Error("A-roll shotDurationSeconds must be positive.");
  }

  const startSeconds = input.startSeconds ?? 0;
  if (!Number.isFinite(startSeconds) || startSeconds < 0 || startSeconds >= input.shotDurationSeconds) {
    throw new Error("A-roll startSeconds must fall inside the shot duration.");
  }
  const speechRateTolerancePercent = input.speechRateTolerancePercent
    ?? (A_ROLL_CONTRACT_DEFAULTS.speechTimingSlackMultiplier - 1) * 100;
  if (!Number.isFinite(speechRateTolerancePercent)
    || speechRateTolerancePercent < 1
    || speechRateTolerancePercent > 25) {
    throw new Error("A-roll speechRateTolerancePercent must be between 1 and 25.");
  }
  const wordCount = spokenText.split(/\s+/).filter(Boolean).length;
  const nominalDurationSeconds = wordCount / input.paceWpm * 60;
  const plannedDurationSeconds = Math.ceil(
    nominalDurationSeconds * (1 + speechRateTolerancePercent / 100) * 100,
  ) / 100;
  const endSeconds = startSeconds + plannedDurationSeconds;
  const terminalSettleSeconds = input.shotDurationSeconds - endSeconds;
  if (terminalSettleSeconds + 0.001 < A_ROLL_CONTRACT_DEFAULTS.minimumTerminalSettleSeconds) {
    throw new Error(
      `A-roll line needs ${plannedDurationSeconds.toFixed(2)}s at ${input.paceWpm} WPM but leaves only ${terminalSettleSeconds.toFixed(2)}s for terminal settle.`,
    );
  }

  return {
    wordCount,
    nominalDurationSeconds,
    plannedDurationSeconds,
    speechRateTolerancePercent,
    startSeconds,
    endSeconds,
    terminalSettleSeconds,
  };
}

export const ARollPostflightObservationSchema = z.object({
  clipDurationSeconds: z.number().positive(),
  frameRateFps: z.number().positive().max(1000).default(A_ROLL_CONTRACT_DEFAULTS.frameRateFps),
  dialogueStatus: z.enum(["verified", "failed", "unknown"]),
  identityStatus: z.enum(["verified", "failed", "unknown"]),
  lipSyncStatus: z.enum(["verified", "failed", "unknown"]),
  terminalBoundaryStatus: z.enum(["passed", "failed", "unknown"]),
  speechEndSeconds: z.number().min(0).optional(),
  stableBoundaryStartSeconds: z.number().min(0).optional(),
  lastStableBoundaryFrameSeconds: z.number().min(0).optional(),
  measuredIntegratedLufs: z.number().min(-70).max(0).optional(),
  measuredTruePeakDbfs: z.number().min(-20).max(0).optional(),
  targetIntegratedLufs: z.number().min(-70).max(0).default(-14),
  targetTruePeakDbfsMax: z.number().min(-20).max(0).default(-1),
}).superRefine((observation, ctx) => {
  for (const [field, value] of [
    ["speechEndSeconds", observation.speechEndSeconds],
    ["stableBoundaryStartSeconds", observation.stableBoundaryStartSeconds],
    ["lastStableBoundaryFrameSeconds", observation.lastStableBoundaryFrameSeconds],
  ] as const) {
    if (value !== undefined && value > observation.clipDurationSeconds) {
      ctx.addIssue({
        code: "custom",
        path: [field],
        message: `${field} must occur within the clip duration`,
      });
    }
  }
  if (
    observation.stableBoundaryStartSeconds !== undefined
    && observation.lastStableBoundaryFrameSeconds !== undefined
    && observation.stableBoundaryStartSeconds > observation.lastStableBoundaryFrameSeconds
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["stableBoundaryStartSeconds"],
      message: "stableBoundaryStartSeconds must not follow lastStableBoundaryFrameSeconds",
    });
  }
});

export type ARollPostflightObservation = z.infer<typeof ARollPostflightObservationSchema>;

export interface ARollPostflightPlan {
  decision: "ACCEPT" | "SALVAGE_AND_REVIEW" | "REGENERATE" | "MANUAL_REVIEW";
  continuationAllowed: boolean;
  trimEndSeconds: number | null;
  normalizeAudio: boolean;
  targetIntegratedLufs: number;
  targetTruePeakDbfsMax: number;
  reasons: string[];
  requiredReaudit: string[];
}

export function planARollPostflight(input: unknown): ARollPostflightPlan {
  const observation = ARollPostflightObservationSchema.parse(input);
  const reasons: string[] = [];
  const requiredReaudit: string[] = [];

  if (observation.dialogueStatus === "failed") reasons.push("exact dialogue failed");
  if (observation.identityStatus === "failed") reasons.push("identity continuity failed");
  if (observation.lipSyncStatus === "failed") reasons.push("audiovisual lip sync failed");
  if (reasons.length) {
    return {
      decision: "REGENERATE",
      continuationAllowed: false,
      trimEndSeconds: null,
      normalizeAudio: false,
      targetIntegratedLufs: observation.targetIntegratedLufs,
      targetTruePeakDbfsMax: observation.targetTruePeakDbfsMax,
      reasons,
      requiredReaudit: ["transcript", "identity", "audiovisual lip sync", "terminal boundary", "audio mix"],
    };
  }

  if (
    observation.dialogueStatus === "unknown"
    || observation.identityStatus === "unknown"
    || observation.terminalBoundaryStatus === "unknown"
  ) {
    return {
      decision: "MANUAL_REVIEW",
      continuationAllowed: false,
      trimEndSeconds: null,
      normalizeAudio: false,
      targetIntegratedLufs: observation.targetIntegratedLufs,
      targetTruePeakDbfsMax: observation.targetTruePeakDbfsMax,
      reasons: ["required transcript, identity, lip-sync, or terminal evidence is unknown"],
      requiredReaudit: ["transcript", "identity", "audiovisual lip sync", "terminal boundary", "audio mix"],
    };
  }

  let trimEndSeconds: number | null = null;
  if (observation.terminalBoundaryStatus === "failed") {
    const stableFrame = observation.lastStableBoundaryFrameSeconds;
    const stableStart = observation.stableBoundaryStartSeconds;
    if (
      stableFrame === undefined
      || stableStart === undefined
      || observation.speechEndSeconds === undefined
    ) {
      const lipSyncUnknown = observation.lipSyncStatus === "unknown";
      return {
        decision: "MANUAL_REVIEW",
        continuationAllowed: false,
        trimEndSeconds: null,
        normalizeAudio: false,
        targetIntegratedLufs: observation.targetIntegratedLufs,
        targetTruePeakDbfsMax: observation.targetTruePeakDbfsMax,
        reasons: [
          "terminal salvage evidence is incomplete; a consecutive stable-frame span is required",
          ...(lipSyncUnknown ? ["fine audiovisual lip-sync evidence is unknown"] : []),
        ],
        requiredReaudit: [
          "speech end and consecutive post-speech stable-frame span",
          ...(lipSyncUnknown ? ["fine audiovisual lip sync"] : []),
        ],
      };
    }
    if (stableStart < observation.speechEndSeconds) {
      return {
        decision: "REGENERATE",
        continuationAllowed: false,
        trimEndSeconds: null,
        normalizeAudio: false,
        targetIntegratedLufs: observation.targetIntegratedLufs,
        targetTruePeakDbfsMax: observation.targetTruePeakDbfsMax,
        reasons: ["terminal boundary failed with no proven post-speech stable-frame span"],
        requiredReaudit: ["terminal boundary"],
      };
    }
    const minimumStableFrameIntervals = A_ROLL_CONTRACT_DEFAULTS.minimumStableBoundaryFrames - 1;
    const observedStableFrameIntervals = (stableFrame - stableStart) * observation.frameRateFps;
    const frameComparisonTolerance = 1e-6;
    if (observedStableFrameIntervals + frameComparisonTolerance < minimumStableFrameIntervals) {
      return {
        decision: "MANUAL_REVIEW",
        continuationAllowed: false,
        trimEndSeconds: null,
        normalizeAudio: false,
        targetIntegratedLufs: observation.targetIntegratedLufs,
        targetTruePeakDbfsMax: observation.targetTruePeakDbfsMax,
        reasons: [
          `stable boundary must span at least ${A_ROLL_CONTRACT_DEFAULTS.minimumStableBoundaryFrames} consecutive frames`,
        ],
        requiredReaudit: ["consecutive post-speech stable-frame span"],
      };
    }
    const trimCandidate = stableFrame + (1 / observation.frameRateFps);
    if (trimCandidate > observation.clipDurationSeconds) {
      return {
        decision: "MANUAL_REVIEW",
        continuationAllowed: false,
        trimEndSeconds: null,
        normalizeAudio: false,
        targetIntegratedLufs: observation.targetIntegratedLufs,
        targetTruePeakDbfsMax: observation.targetTruePeakDbfsMax,
        reasons: [
          "stable-frame timestamp cannot preserve one full frame within the clip",
          ...(observation.lipSyncStatus === "unknown" ? ["fine audiovisual lip-sync evidence is unknown"] : []),
        ],
        requiredReaudit: [
          "post-speech stable-frame timestamp and frame rate",
          ...(observation.lipSyncStatus === "unknown" ? ["fine audiovisual lip sync"] : []),
        ],
      };
    }
    trimEndSeconds = trimCandidate;
    reasons.push("trim after the last proven post-speech stable frame");
    requiredReaudit.push("terminal boundary after trim");
  }

  if (
    observation.measuredIntegratedLufs === undefined
    || observation.measuredTruePeakDbfs === undefined
  ) {
    const lipSyncUnknown = observation.lipSyncStatus === "unknown";
    return {
      decision: "MANUAL_REVIEW",
      continuationAllowed: false,
      trimEndSeconds,
      normalizeAudio: false,
      targetIntegratedLufs: observation.targetIntegratedLufs,
      targetTruePeakDbfsMax: observation.targetTruePeakDbfsMax,
      reasons: [
        "required audio measurements are unknown",
        ...(lipSyncUnknown ? ["fine audiovisual lip-sync evidence is unknown"] : []),
      ],
      requiredReaudit: [
        ...requiredReaudit,
        "integrated loudness and true peak",
        ...(lipSyncUnknown ? ["fine audiovisual lip sync"] : []),
      ],
    };
  }

  const normalizeAudio = (
    Math.abs(observation.measuredIntegratedLufs - observation.targetIntegratedLufs) > 1
    || observation.measuredTruePeakDbfs > observation.targetTruePeakDbfsMax + 0.1
  );
  if (normalizeAudio) {
    reasons.push("master audio to the declared integrated loudness and true-peak targets");
    requiredReaudit.push("integrated loudness and true peak after mastering");
  }

  if (observation.lipSyncStatus === "unknown") {
    return {
      decision: "MANUAL_REVIEW",
      continuationAllowed: false,
      trimEndSeconds,
      normalizeAudio,
      targetIntegratedLufs: observation.targetIntegratedLufs,
      targetTruePeakDbfsMax: observation.targetTruePeakDbfsMax,
      reasons: [...reasons, "fine audiovisual lip-sync evidence is unknown"],
      requiredReaudit: [...requiredReaudit, "fine audiovisual lip sync"],
    };
  }

  if (trimEndSeconds !== null || normalizeAudio) {
    return {
      decision: "SALVAGE_AND_REVIEW",
      continuationAllowed: false,
      trimEndSeconds,
      normalizeAudio,
      targetIntegratedLufs: observation.targetIntegratedLufs,
      targetTruePeakDbfsMax: observation.targetTruePeakDbfsMax,
      reasons,
      requiredReaudit,
    };
  }

  return {
    decision: "ACCEPT",
    continuationAllowed: true,
    trimEndSeconds: null,
    normalizeAudio: false,
    targetIntegratedLufs: observation.targetIntegratedLufs,
    targetTruePeakDbfsMax: observation.targetTruePeakDbfsMax,
    reasons: ["dialogue, identity, audiovisual lip sync, terminal boundary, and mix passed"],
    requiredReaudit: [],
  };
}
