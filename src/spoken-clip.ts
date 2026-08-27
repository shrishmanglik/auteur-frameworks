import { z } from "zod";

export const SpokenClipPlanInputSchema = z.object({
  script: z.string().trim().min(1),
  performanceCue: z.string().trim().min(1),
  supportedDurationsSeconds: z.array(z.number().int().positive()).min(1),
  paceWpm: z.number().min(60).max(240),
  leadInSeconds: z.number().min(0).max(2).default(0.15),
  terminalSettleSeconds: z.number().min(0.25).max(3).default(0.55),
  timingSlackPercent: z.number().min(0).max(25).default(8),
}).superRefine((input, ctx) => {
  if (new Set(input.supportedDurationsSeconds).size !== input.supportedDurationsSeconds.length) {
    ctx.addIssue({
      code: "custom",
      path: ["supportedDurationsSeconds"],
      message: "supportedDurationsSeconds must not contain duplicates",
    });
  }
});

export type SpokenClipPlanInput = z.infer<typeof SpokenClipPlanInputSchema>;

export interface SpokenClipPlan {
  script: string;
  audibleWordCount: number;
  nominalSpeechSeconds: number;
  requiredContainerSeconds: number;
  selectedDurationSeconds: number;
  performanceCue: string;
  prompt: string;
  assumptions: string[];
}

export function countAudibleWords(script: string): number {
  return script.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

/** Shared with the compact-prompt guard in compiler.ts; kept here as the single copy. */
export function countExactOccurrences(haystack: string, needle: string): number {
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

export function planSpokenClip(input: unknown): SpokenClipPlan {
  const parsed = SpokenClipPlanInputSchema.parse(input);
  const audibleWordCount = countAudibleWords(parsed.script);
  if (audibleWordCount === 0) {
    throw new Error("Spoken clip planning requires at least one audible word.");
  }

  const nominalSpeechSeconds = audibleWordCount / parsed.paceWpm * 60;
  const requiredContainerSeconds = (
    parsed.leadInSeconds
    + nominalSpeechSeconds * (1 + parsed.timingSlackPercent / 100)
    + parsed.terminalSettleSeconds
  );
  const supported = [...parsed.supportedDurationsSeconds].sort((a, b) => a - b);
  const selectedDurationSeconds = supported.find((duration) => duration >= requiredContainerSeconds);
  if (selectedDurationSeconds === undefined) {
    throw new Error(
      `No caller-declared duration can contain ${audibleWordCount} audible words; `
      + `requires ${requiredContainerSeconds.toFixed(2)}s including lead-in and settle.`,
    );
  }

  const prompt = [
    "Create one uninterrupted, photorealistic A-roll take from the supplied identity and set reference.",
    `Container: ${selectedDurationSeconds} seconds.`,
    `Performance cue: ${parsed.performanceCue}`,
    "Deliver the thought as connected natural speech with sentence-level phrasing, not isolated slogan fragments.",
    "Begin without a theatrical pause. After the final word, close the thought naturally and settle without starting another mouth, gesture, or expression cycle.",
    "No captions, subtitles, added graphics, invented words, restart, correction, repetition, or silent mouthing.",
    `SCRIPT - speak exactly once:\n${parsed.script}`,
  ].join("\n\n");

  if (countExactOccurrences(prompt, parsed.script) !== 1) {
    throw new Error("Compiled spoken-clip prompt must contain the approved script exactly once.");
  }

  return {
    script: parsed.script,
    audibleWordCount,
    nominalSpeechSeconds,
    requiredContainerSeconds,
    selectedDurationSeconds,
    performanceCue: parsed.performanceCue,
    prompt,
    assumptions: [
      "Supported durations are caller-declared provider capability, not an AUTEUR capability claim.",
      "Timing is an audible-word planning estimate and must be verified against returned media.",
      "One performance cue reduces competing motion and delivery instructions.",
    ],
  };
}
