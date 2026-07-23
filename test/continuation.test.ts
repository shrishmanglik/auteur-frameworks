import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ContinuationInputSchema,
  buildRepairPrompt,
  compileContinuationPrompt,
} from "../src/index.js";

const example = JSON.parse(fs.readFileSync(new URL("../examples/continuation.json", import.meta.url), "utf8"));

describe("render-observed continuation", () => {
  it("compiles the observed boundary, first motion, and spatial bridge ahead of downstream beats", () => {
    const result = compileContinuationPrompt(example);

    expect(result.frameworkId).toBe("render-observed-continuation");
    expect(result.prompt).toContain("FRAME 0 MATCH");
    expect(result.prompt).toContain("ONE UNBROKEN TAKE");
    expect(result.prompt).toContain("BY 0.75s - FIRST MOTION");
    expect(result.prompt).toContain("BY 2s - PHYSICAL BRIDGE");
    expect(result.prompt).toContain("CAMERA PATH");
    expect(result.prompt).toContain("no lens, height, axis, reverse-angle, or coverage jump");
    expect(result.prompt).toContain("passes through the same rectangular aperture");
    expect(result.prompt).toContain("[2-6s]");
    expect(result.prompt).not.toContain("[0-2s]");
    expect(result.prompt.length).toBeLessThan(2400);
    expect(result.negativePrompt).toContain("no dissolve");
    expect(result.negativePrompt).toContain("no teleport");
    const withManyExclusions = structuredClone(example);
    withManyExclusions.globalExclusions = Array.from(
      { length: 12 },
      (_, index) => "no synthetic exclusion " + String(index + 1).padStart(2, "0"),
    );
    const completeExclusions = compileContinuationPrompt(withManyExclusions);
    for (const exclusion of withManyExclusions.globalExclusions) expect(completeExclusions.prompt).toContain(exclusion);
  });

  it("rejects a first-motion deadline that occurs after the bridge", () => {
    const broken = structuredClone(example);
    broken.contract.firstMotion.mustBeginBySeconds = 1.5;
    broken.contract.spatialBridge.completeBySeconds = 1;
    expect(() => ContinuationInputSchema.parse(broken)).toThrow("first motion must begin");
  });

  it("offers a provider-safe repair for fictional-name collisions", () => {
    const prompt = buildRepairPrompt({
      failure: "PUBLIC_FIGURE_NAME_COLLISION",
      observedSymptom: "An invented character name triggered a prominent-person rejection.",
      preserve: ["same role", "same suit", "same face"],
    });
    expect(prompt).toContain("unsupported proper name");
    expect(prompt).toContain("never imply a real person");
  });

  it("offers render-observed repairs for match-frame and camera-path drift", () => {
    const matchFrame = buildRepairPrompt({
      failure: "MATCH_FRAME_DRIFT",
      observedSymptom: "The extension restaged the pilot before the first motion.",
      preserve: ["accepted final frame", "camera axis", "subject pose"],
    });
    const cameraPath = buildRepairPrompt({
      failure: "CAMERA_PATH_JUMP",
      observedSymptom: "The camera jumped from an over-shoulder reveal to a frontal close-up.",
      preserve: ["one camera body", "one lens", "screen direction"],
    });

    expect(matchFrame).toContain("final frame as frame zero");
    expect(cameraPath).toContain("forbid lens, height, axis, reverse-angle, and coverage jumps");
  });

  it("quotes spoken performance without corrupting terminal punctuation", () => {
    const withDialogue = structuredClone(example);
    withDialogue.shot.audioTrack.spokenText = "Don't bring it home.";
    withDialogue.contract.dialogueCue = {
      startSeconds: 2,
      endSeconds: 5,
      speaker: "future radio voice",
      delivery: "an intimate warning",
      mixPriority: "foreground",
    };
    const result = compileContinuationPrompt(withDialogue);

    expect(result.prompt).toContain('AUDIO PERFORMANCE [2-5s]: future radio voice says exactly once, "Don\'t bring it home."');
    expect(result.prompt).toContain("intelligible foreground above ambience");
    expect(result.prompt).toContain("No paraphrase, repetition, substitute words, or subtitles");
    expect(result.prompt.indexOf("AUDIO PERFORMANCE")).toBeLessThan(result.prompt.indexOf("LOCK:"));
    expect(result.prompt).not.toContain("home.;");
    expect(result.prompt).not.toContain('home.".');
  });

  it("rejects a dialogue cue outside the target shot", () => {
    const withLateDialogue = structuredClone(example);
    withLateDialogue.shot.audioTrack.spokenText = "Wait.";
    withLateDialogue.contract.dialogueCue = {
      startSeconds: 7,
      endSeconds: 9,
      speaker: "pilot",
      delivery: "urgent",
      mixPriority: "foreground",
    };

    expect(() => ContinuationInputSchema.parse(withLateDialogue)).toThrow("dialogue cue must end");
  });

  it("uses legacy shot.dialogue as the canonical spoken performance", () => {
    const withDialogue = structuredClone(example);
    withDialogue.shot.dialogue = "Stay with me.";
    delete withDialogue.shot.audioTrack.spokenText;
    withDialogue.contract.dialogueCue = {
      startSeconds: 2,
      endSeconds: 4,
      speaker: "pilot",
      delivery: "controlled",
      mixPriority: "foreground",
    };

    const result = compileContinuationPrompt(withDialogue);
    expect(result.prompt).toContain('pilot says exactly once, "Stay with me."');
    expect(result.prompt).not.toContain("invent no dialogue");
  });

  it("rejects a dialogue cue without any spoken text", () => {
    const withoutDialogue = structuredClone(example);
    delete withoutDialogue.shot.dialogue;
    delete withoutDialogue.shot.audioTrack.spokenText;
    withoutDialogue.contract.dialogueCue = {
      startSeconds: 2,
      endSeconds: 4,
      speaker: "pilot",
      delivery: "controlled",
      mixPriority: "foreground",
    };

    expect(() => ContinuationInputSchema.parse(withoutDialogue)).toThrow("dialogue cue requires");
  });

  it("rejects conflicting dialogue representations", () => {
    const conflicting = structuredClone(example);
    conflicting.shot.dialogue = "Stay with me.";
    conflicting.shot.audioTrack.spokenText = "Leave now.";

    expect(() => ContinuationInputSchema.parse(conflicting)).toThrow("must contain the same performance");
  });

  it("preserves the remainder of a beat crossed by the bridge deadline", () => {
    const midBeatBridge = structuredClone(example);
    midBeatBridge.contract.firstMotion.mustBeginBySeconds = 0.5;
    midBeatBridge.contract.spatialBridge.completeBySeconds = 1.5;
    const result = compileContinuationPrompt(midBeatBridge);

    expect(result.prompt).toContain("[1.5-2s] continue:");
    expect(result.prompt).toContain("[2-6s]");
  });

  it("offers a repair when requested dialogue is absent", () => {
    const prompt = buildRepairPrompt({
      failure: "DIALOGUE_OMITTED",
      observedSymptom: "The stereo track contains ambience but no intelligible requested line.",
      preserve: ["visual continuity", "existing ambience", "speaker identity"],
    });

    expect(prompt).toContain("quote the exact line once");
    expect(prompt).toContain("mix intelligible speech above ambience");
  });

  it("preserves every deduplicated sound directive and the music boundary", () => {
    const withAudio = structuredClone(example);
    withAudio.shot.audioTrack.soundDesignDirectives = [
      "heavy hinge grind",
      "radio static narrows under speech",
      "heavy hinge grind",
    ];
    withAudio.shot.audioTrack.musicDirective = "one restrained sub-bass pulse";
    const result = compileContinuationPrompt(withAudio);

    expect(result.prompt).toContain("Sound: heavy hinge grind; radio static narrows under speech.");
    expect(result.prompt.match(/heavy hinge grind/g)).toHaveLength(1);
    expect(result.prompt).toContain("Music: one restrained sub-bass pulse.");
  });
});
