import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FRAMEWORKS,
  ContentFormatSchema,
  UniversalPacketSchema,
  buildRepairPrompt,
  buildStoryboard,
  buildDevelopmentContract,
  compilePacket,
  compileCompactVideoPrompt,
  compileCompactVideoPromptWithReport,
  compileShot,
  depthOfFieldCharacter,
  preflightPacket,
} from "../src/index.js";

const example = JSON.parse(fs.readFileSync(new URL("../examples/product-film.json", import.meta.url), "utf8"));

describe("universal packet", () => {
  it("parses the synthetic product-film example", () => {
    const packet = UniversalPacketSchema.parse(example);
    expect(packet.shots).toHaveLength(1);
    expect(packet.shots[0]?.camera.capture).toEqual({});
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

  it("routes explicit production problems to their native framework architectures", () => {
    const base = {
      idea: "An original production problem with one observable action and a measurable final state.",
      format: "other" as const,
      targetDurationSeconds: 8,
      aspectRatio: "16:9" as const,
      audience: "professional filmmakers",
      tone: ["specific", "physical"],
    };
    expect(buildDevelopmentContract({ ...base, requiresPracticalChoreography: true }).framework.id)
      .toBe("practical-stunt-contract");
    expect(buildDevelopmentContract({ ...base, requiresMachineReadableSceneContract: true }).framework.id)
      .toBe("json-scene-contract");
    expect(buildDevelopmentContract({ ...base, audioFirst: true }).framework.id)
      .toBe("audio-contract");
  });

  it("builds a development contract for every public content format", () => {
    const expectedRoutes = {
      "short-film": "act-shot-master-spec",
      ad: "cinematic-prose-stack",
      reel: "timed-social-sequence",
      "a-roll": "continuous-take",
      "b-roll": "cinematic-prose-stack",
      "music-video": "act-shot-master-spec",
      "product-film": "cinematic-prose-stack",
      "character-scene": "continuous-take",
      vfx: "temporal-evolution",
      animation: "cinematic-prose-stack",
      image: "cinematic-prose-stack",
      sequence: "act-shot-master-spec",
      other: "cinematic-prose-stack",
    } as const;
    for (const format of ContentFormatSchema.options) {
      const contract = buildDevelopmentContract({
        idea: `An original ${format} concept with one observable action and an earned final state.`,
        format,
        targetDurationSeconds: 24,
        aspectRatio: "16:9",
        audience: "general creative audience",
        tone: ["specific", "human"],
      });
      expect(contract.request.format).toBe(format);
      expect(contract.framework.id).toBe(expectedRoutes[format]);
      expect(contract.responseSchema).toBeTypeOf("object");
    }
  });
});

describe("compiler", () => {
  it("puts optics before movement and emits all generation surfaces", () => {
    const shot = UniversalPacketSchema.parse(example).shots[0]!;
    const compiled = compileShot(shot);
    expect(compiled.videoPrompt.indexOf("100mm")).toBeLessThan(compiled.videoPrompt.indexOf("slider"));
    expect(compiled.promptFidelity).toBe("FRAMEWORK_NATIVE");
    expect(compiled.frameworkName).toBe("Cinematic Prose Stack");
    expect(compiled.compactVideoPrompt).toContain("[0-2s]");
    expect(compiled.compactVideoPrompt).toContain("100mm");
    expect(compiled.compactVideoPrompt).toContain("PREMISE:");
    expect(compiled.compactVideoPrompt).toContain("REALITY ANCHOR:");
    expect(compiled.compactVideoPrompt).toContain("OPTICS AND CAMERA:");
    expect(compiled.compactVideoPrompt).toContain("SEQUENCE:");
    expect(compiled.compactVideoPrompt).toContain("EXPRESSION AND EXCLUSIONS:");
    expect(compiled.compactVideoPrompt).toContain("no identity drift");
    expect(compiled.compactPromptReport.frameworkPreserved).toBe(true);
    expect(compiled.framePrompt).toContain("tiny trapped bubbles");
    expect(compiled.audioPrompt).toContain("liquid pour");
    expect(compiled.negativePrompt).toContain("no identity drift");
  });

  it("compiles genuinely distinct corpus architectures instead of relabeling one template", () => {
    const baseShot = structuredClone(UniversalPacketSchema.parse(example).shots[0]!);
    const expectedSignatures = {
      "cinematic-prose-stack": "PREMISE:",
      "act-shot-master-spec": "TECHNICAL MASTER SPECIFICATIONS:",
      "json-scene-contract": "\"metadata\"",
      "temporal-evolution": "INITIAL STATE (0.0s):",
      "timed-social-sequence": "HOOK (FIRST 2 SECONDS):",
      "practical-stunt-contract": "CONTINUOUS CAMERA MOVE (8000ms):",
      "continuous-take": "A single unbroken 8-second take",
      "audio-contract": "PRIMARY SOURCE AND PERFORMANCE:",
    } as const;
    const prompts = Object.entries(expectedSignatures).map(([frameworkId, signature]) => {
      const shot = structuredClone(baseShot);
      shot.frameworkId = frameworkId;
      if (frameworkId === "practical-stunt-contract") {
        shot.camera.capture = {
          sensorFormat: "Super 35 digital cinema sensor",
          recordingFormat: "log acquisition",
          rig: "low tracking vehicle rig",
          frameRateFps: 24,
          shutterAngleDegrees: 180,
          resolutionIntent: "4K finish",
        };
      }
      const compiled = compileShot(shot, example.globalExclusions, example.globalStyle, {
        aspectRatio: "16:9",
        audience: "filmmakers",
        contentFormat: "product-film",
        productionTitle: "Architecture fidelity test",
        shotCount: 1,
        shotIndex: 0,
      });
      expect(compiled.videoPrompt, frameworkId).toContain(signature);
      expect(compiled.compactVideoPrompt, frameworkId).toContain(signature);
      expect(compiled.frameworkArchitecture.length, frameworkId).toBeGreaterThanOrEqual(5);
      expect(compiled.compactPromptReport.frameworkPreserved).toBe(true);
      if (frameworkId === "practical-stunt-contract") {
        expect(compiled.videoPrompt).toContain("24fps");
        expect(compiled.videoPrompt).toContain("180-degree shutter");
      }
      return compiled.videoPrompt;
    });
    expect(new Set(prompts).size).toBe(Object.keys(expectedSignatures).length);
  });

  it("fails closed when evidence-specific frameworks are used through the generic shot compiler", () => {
    const baseShot = structuredClone(UniversalPacketSchema.parse(example).shots[0]!);
    const repairShot = structuredClone(baseShot);
    repairShot.frameworkId = "repair-pass";
    expect(() => compileShot(repairShot)).toThrow("use buildRepairPrompt");

    const continuationShot = structuredClone(baseShot);
    continuationShot.frameworkId = "render-observed-continuation";
    expect(() => compileShot(continuationShot)).toThrow("use compileContinuationPrompt");
  });

  it("emits exact dialogue once even when action and beat text repeat it", () => {
    for (const frameworkId of ["continuous-take", "audio-contract"]) {
      const shot = structuredClone(UniversalPacketSchema.parse(example).shots[0]!);
      shot.frameworkId = frameworkId;
      shot.dialogue = "Hold the frame.";
      shot.audioTrack.spokenText = "Hold the frame.";
      shot.action = "the craftsperson says Hold the frame. and steadies the glass";
      shot.beats[2]!.action = "the craftsperson says Hold the frame. while the liquid settles";
      const compiled = compileShot(shot);
      expect(compiled.videoPrompt.match(/Hold the frame\./g), frameworkId).toHaveLength(1);
    }
  });

  it("offers a deterministic compact handoff without losing production categories", () => {
    const shot = UniversalPacketSchema.parse(example).shots[0]!;
    const compact = compileCompactVideoPrompt(shot, example.globalExclusions);
    expect(compact).toBe(compileCompactVideoPrompt(shot, example.globalExclusions));
    expect(compact.split("\n")).toHaveLength(1);
  });

  it("prioritizes shot-specific safeguards over generic exclusions in compact prompts", () => {
    const shot = structuredClone(UniversalPacketSchema.parse(example).shots[0]!);
    shot.exclusions = [
      ...example.globalExclusions,
      "no widened eyes or mugging",
      "do not begin after the contact event",
      "no contact-free object motion",
      "no static payoff pose",
      "no added reaction beat",
      "no reverse motion",
      "no object duplication",
      "no skipped terminal state",
      "no unrelated camera mark",
    ];
    const compact = compileCompactVideoPrompt(shot, example.globalExclusions);
    expect(compact).toContain("no widened eyes or mugging");
    expect(compact).toContain("do not begin after the contact event");
    expect(compact).toContain("no added reaction beat");
    expect(compact).toContain("no unrelated camera mark");
  });

  it("derives depth-of-field character from optics", () => {
    expect(depthOfFieldCharacter({ focalLengthMm: 24, tStop: 8, subjectDistanceMeters: 5 })).toContain("deep focus");
    expect(depthOfFieldCharacter({ focalLengthMm: 85, tStop: 1.4, subjectDistanceMeters: 1.2 })).toContain("very shallow");
  });

  it("bounds compact prompts and reports every omitted safeguard", () => {
    const shot = structuredClone(UniversalPacketSchema.parse(example).shots[0]!);
    shot.exclusions = Array.from({ length: 100 }, (_, index) => (
      `no synthetic failure mode ${index + 1} with duplicated geometry and unrelated motion`
    ));
    const result = compileCompactVideoPromptWithReport(shot);
    expect(result.prompt.length).toBeLessThanOrEqual(result.toolkitBudget);
    expect(result.wasCompacted).toBe(true);
    expect(result.frameworkPreserved).toBe(result.truncatedSections.length === 0);
    expect(result.omittedExclusions.length).toBeGreaterThan(0);
    expect(result.prompt).toContain("no identity drift");
    expect(result.prompt).toContain("no geometry morphing");
    expect(result.characterCount).toBe(result.prompt.length);
  });

  it("reports global exclusions that do not fit the compact prompt budget", () => {
    const shot = structuredClone(UniversalPacketSchema.parse(example).shots[0]!);
    const globalExclusions = Array.from({ length: 40 }, (_, index) => (
      `no global failure mode ${index + 1} with unrelated geometry, text, or motion`
    ));
    const result = compileCompactVideoPromptWithReport(shot, globalExclusions, [], {
      maxCharacters: 1200,
    });
    expect(result.prompt.length).toBeLessThanOrEqual(1200);
    expect(result.omittedExclusions).toContain(globalExclusions.at(-1));
    expect(result.wasCompacted).toBe(true);
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
    expect(result.shots[0]?.videoPrompt).toContain("16:9");
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

  it("repairs exaggerated performance without redesigning the shot", () => {
    const prompt = buildRepairPrompt({
      failure: "PERFORMANCE_EXAGGERATION",
      observedSymptom: "The actor widens their eyes instead of holding the deadpan beat.",
      preserve: ["actor identity", "elevator geometry", "board dimensions"],
    });
    expect(prompt).toContain("one observable micro-expression");
    expect(prompt).toContain("forbid mugging");
  });
});
