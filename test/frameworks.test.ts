import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FRAMEWORKS,
  UniversalPacketSchema,
  buildRepairPrompt,
  buildStoryboard,
  buildDevelopmentContract,
  compilePacket,
  compileCompactVideoPrompt,
  compileShot,
  depthOfFieldCharacter,
  preflightPacket,
} from "../src/index.js";

const example = JSON.parse(fs.readFileSync(new URL("../examples/product-film.json", import.meta.url), "utf8"));

describe("universal packet", () => {
  it("parses the synthetic product-film example", () => {
    expect(UniversalPacketSchema.parse(example).shots).toHaveLength(1);
  });

  it("ships a distinct provider-neutral framework registry", () => {
    expect(FRAMEWORKS.length).toBeGreaterThanOrEqual(9);
    expect(new Set(FRAMEWORKS.map((item) => item.id)).size).toBe(FRAMEWORKS.length);
  });
});

describe("development contract", () => {
  it("routes a raw short-film idea into a schema-bound act/shot contract", () => {
    const contract = buildDevelopmentContract({
      idea: "A night-shift cleaner finds one office elevator stopping at a floor that does not exist.",
      format: "short-film",
      targetDurationSeconds: 90,
      aspectRatio: "2.39:1",
      audience: "adult suspense viewers",
      tone: ["dry", "uneasy", "human"],
      constraints: ["one actor", "one location"],
      hasDialogue: true,
      requiresTransformation: false,
      audioRequired: true,
    });
    expect(contract.framework.id).toBe("act-shot-master-spec");
    expect(contract.systemInstruction).toContain("Return only data");
    expect(contract.responseSchema).toBeTypeOf("object");
  });

  it("routes transformation work to temporal evolution", () => {
    const contract = buildDevelopmentContract({
      idea: "A paper city folds itself into a working mechanical clock in one unbroken view.",
      format: "vfx",
      targetDurationSeconds: 12,
      aspectRatio: "16:9",
      audience: "design and motion audiences",
      tone: ["precise", "tactile"],
      requiresTransformation: true,
    });
    expect(contract.framework.id).toBe("temporal-evolution");
  });
});

describe("compiler", () => {
  it("puts optics before movement and emits all generation surfaces", () => {
    const shot = UniversalPacketSchema.parse(example).shots[0]!;
    const compiled = compileShot(shot);
    expect(compiled.videoPrompt.indexOf("100mm")).toBeLessThan(compiled.videoPrompt.indexOf("slider"));
    expect(compiled.compactVideoPrompt.length).toBeLessThan(compiled.videoPrompt.length);
    expect(compiled.compactVideoPrompt).toContain("[0-2s]");
    expect(compiled.compactVideoPrompt).toContain("100mm");
    expect(compiled.compactVideoPrompt).toContain("Physics:");
    expect(compiled.compactVideoPrompt).toContain("Lock:");
    expect(compiled.compactVideoPrompt).toContain("Audio:");
    expect(compiled.compactVideoPrompt).toContain("no identity drift");
    expect(compiled.framePrompt).toContain("tiny trapped bubbles");
    expect(compiled.audioPrompt).toContain("liquid pour");
    expect(compiled.negativePrompt).toContain("no identity drift");
  });

  it("offers a deterministic compact handoff without losing production categories", () => {
    const shot = UniversalPacketSchema.parse(example).shots[0]!;
    const compact = compileCompactVideoPrompt(shot, example.globalExclusions);
    expect(compact).toBe(compileCompactVideoPrompt(shot, example.globalExclusions));
    expect(compact.split("\n")).toHaveLength(1);
  });

  it("derives depth-of-field character from optics", () => {
    expect(depthOfFieldCharacter({ focalLengthMm: 24, tStop: 8, subjectDistanceMeters: 5 })).toContain("deep focus");
    expect(depthOfFieldCharacter({ focalLengthMm: 85, tStop: 1.4, subjectDistanceMeters: 1.2 })).toContain("very shallow");
  });

  it("compiles a complete package with a passing preflight", () => {
    const twoShotExample = structuredClone(example);
    const secondShot = structuredClone(twoShotExample.shots[0]);
    secondShot.id = "shot-2";
    secondShot.title = "Second pour angle";
    twoShotExample.shots.push(secondShot);
    twoShotExample.scenes[0].shotIds.push(secondShot.id);
    twoShotExample.metadata.targetDurationSeconds = 16;

    const result = compilePacket(twoShotExample);
    expect(result.shots).toHaveLength(2);
    expect(result.preflight.passed).toBe(true);
    for (const shot of result.shots) {
      for (const exclusion of twoShotExample.globalExclusions) {
        expect(shot.negativePrompt.split(exclusion)).toHaveLength(2);
        expect(shot.videoPrompt.split(exclusion)).toHaveLength(2);
      }
    }
  });

  it("preserves every required global style term in compiled prompts", () => {
    const result = compilePacket(example);
    for (const style of example.globalStyle) {
      expect(result.shots[0]?.videoPrompt).toContain(style);
      expect(result.shots[0]?.framePrompt).toContain(style);
    }
  });
});

describe("storyboard and QC", () => {
  it("projects shots into useful storyboard panels", () => {
    const board = buildStoryboard(example);
    expect(board[0]).toMatchObject({ shotId: "shot-1", durationSeconds: 8 });
    expect(board[0]?.framePrompt).toContain("hand-blown clear tumbler");
  });

  it("fails a temporal duration mismatch", () => {
    const broken = structuredClone(example);
    broken.shots[0].beats[2].endSeconds = 7;
    const report = preflightPacket(UniversalPacketSchema.parse(broken));
    expect(report.passed).toBe(false);
    expect(report.issues.some((issue) => issue.code === "DURATION_MISMATCH")).toBe(true);
  });

  it("accepts spokenText as a complete required audio contract", () => {
    const spokenOnly = structuredClone(example);
    spokenOnly.shots[0].dialogue = undefined;
    spokenOnly.shots[0].audioTrack = {
      spokenText: "The detail is the proof.",
      soundDesignDirectives: [],
    };
    const report = preflightPacket(UniversalPacketSchema.parse(spokenOnly));
    expect(report.issues.some((issue) => issue.code === "AUDIO_CONTRACT_MISSING")).toBe(false);
  });

  it("blocks duplicate shot identifiers", () => {
    const duplicate = structuredClone(example);
    duplicate.shots.push(structuredClone(duplicate.shots[0]));
    duplicate.scenes[0].shotIds.push("shot-1");
    duplicate.metadata.targetDurationSeconds = 16;
    const report = preflightPacket(UniversalPacketSchema.parse(duplicate));
    expect(report.passed).toBe(false);
    expect(report.issues.some((issue) => issue.code === "DUPLICATE_SHOT_ID")).toBe(true);
  });

  it("builds a constrained repair prompt", () => {
    const prompt = buildRepairPrompt({
      failure: "OBJECT_CONSERVATION",
      observedSymptom: "The glass disappears after the pour begins.",
      preserve: ["camera move", "workshop light", "glass geometry"],
    });
    expect(prompt).toContain("persistent objects");
    expect(prompt).toContain("PRESERVE");
  });
});
