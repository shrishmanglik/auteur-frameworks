import { describe, expect, it } from "vitest";
import { countAudibleWords, planSpokenClip } from "../src/index.js";

describe("spoken clip planning", () => {
  it("selects the smallest caller-supported container that fits audible words", () => {
    const plan = planSpokenClip({
      script: "Give me one process break and I will trace the system behind it.",
      performanceCue: "Connected founder cadence with restrained confidence.",
      supportedDurationsSeconds: [10, 4, 8, 6],
      paceWpm: 170,
    });
    expect(plan.audibleWordCount).toBe(13);
    expect(plan.selectedDurationSeconds).toBe(6);
    expect(plan.prompt.split(plan.script)).toHaveLength(2);
    expect(plan.prompt.match(/Performance cue:/g)).toHaveLength(1);
  });

  it("counts contractions and hyphenated speech as audible words", () => {
    expect(countAudibleWords("Here's one well-paced thought." )).toBe(4);
  });

  it("refuses to invent a duration when caller-declared capability cannot fit", () => {
    expect(() => planSpokenClip({
      script: "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen",
      performanceCue: "Natural connected delivery.",
      supportedDurationsSeconds: [4, 6],
      paceWpm: 120,
    })).toThrow(/No caller-declared duration/);
  });

  it("rejects duplicate capability declarations", () => {
    expect(() => planSpokenClip({
      script: "One clear thought.",
      performanceCue: "Natural delivery.",
      supportedDurationsSeconds: [4, 4, 6],
      paceWpm: 150,
    })).toThrow(/must not contain duplicates/);
  });
});
