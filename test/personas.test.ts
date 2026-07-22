import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildProductionKit,
  buildStoryboard,
  compilePacket,
  parseUniversalPacket,
  preflightPacket,
} from "../src/index.js";

const load = (name: string) => JSON.parse(
  fs.readFileSync(new URL(`../examples/${name}.json`, import.meta.url), "utf8"),
);

const personas = [
  { name: "commercial director", fixture: "product-film" },
  { name: "narrative director", fixture: "short-film" },
  { name: "vertical creator", fixture: "vertical-reel" },
  { name: "A-roll operator", fixture: "a-roll" },
] as const;

describe("expert creator fixtures", () => {
  for (const persona of personas) {
    it(`${persona.name} packet validates, preflights, storyboards, and compiles`, () => {
      const packet = parseUniversalPacket(load(persona.fixture));
      const report = preflightPacket(packet);
      const storyboard = buildStoryboard(packet);
      const compiled = compilePacket(packet);
      const kit = buildProductionKit(packet);

      expect(report.passed, JSON.stringify(report.issues, null, 2)).toBe(true);
      expect(storyboard).toHaveLength(packet.shots.length);
      expect(compiled.shots).toHaveLength(packet.shots.length);
      expect(kit.shotList).toHaveLength(packet.shots.length);
      expect(kit.storyboard).toHaveLength(packet.shots.length);
      expect(kit.promptPackage).toEqual(compiled);
      expect(kit.preflight).toEqual(report);
      expect(compiled.shots.every((shot) => shot.promptFidelity === "FRAMEWORK_NATIVE")).toBe(true);
      expect(compiled.shots.every((shot) => shot.frameworkArchitecture.length >= 5)).toBe(true);
      expect(compiled.shots.every((shot) => shot.negativePrompt.length > 30)).toBe(true);
      expect(compiled.shots.every((shot) => shot.compactVideoPrompt.length <= 5000)).toBe(true);
      expect(compiled.shots.every((shot) => shot.compactPromptReport.frameworkPreserved)).toBe(true);
      for (const shot of compiled.shots) {
        expect(shot.videoPrompt, `${persona.name} missing camera specificity`).toMatch(/CAMERA|Camera|camera/);
        expect(shot.videoPrompt, `${persona.name} missing temporal specificity`).toMatch(/SEQUENCE|BEAT|Beat|timeline|time_range_seconds|0-/);
        expect(shot.videoPrompt, `${persona.name} missing audio contract`).toMatch(/AUDIO|Audio|audio/);
        expect(shot.videoPrompt, `${persona.name} missing exclusions`).toMatch(/DO NOT RENDER|NEGATIVES|EXCLUSIONS|no identity drift/);
      }
    });
  }

  it("gives the narrative director causal scenes, continuity, and an earned choice", () => {
    const packet = parseUniversalPacket(load("short-film"));
    expect(packet.scenes.length).toBeGreaterThanOrEqual(2);
    expect(packet.story.beats).toHaveLength(3);
    expect(packet.shots.every((shot) => shot.continuityLocks.length >= 3)).toBe(true);
    expect(packet.shots.at(-1)?.action).toContain("leaves her keys");
  });

  it("gives the vertical creator a first-second hook, legible vertical route, and loop", () => {
    const packet = parseUniversalPacket(load("vertical-reel"));
    expect(packet.metadata.aspectRatio).toBe("9:16");
    expect(packet.shots[0]?.beats[0]?.endSeconds).toBeLessThanOrEqual(1);
    expect(packet.shots.at(-1)?.beats.at(-1)?.action).toContain("loop");
    expect(preflightPacket(packet).issues.some((issue) => issue.code === "GENERATED_TEXT_RISK")).toBe(true);
  });

  it("gives the A-roll operator one non-duplicated spoken performance", () => {
    const packet = parseUniversalPacket(load("a-roll"));
    const compiled = compilePacket(packet).shots[0]!;
    expect(packet.shots[0]?.frameworkId).toBe("avatar-a-roll-json");
    expect(JSON.parse(compiled.videoPrompt).project_manifest.layer_vi_ai_model_constraints
      .triple_lock_protocol.script_lock.rule).toContain("verbatim once");
    expect(compiled.audioPrompt?.match(/We spent three weeks/g)).toHaveLength(1);
    expect(compiled.videoPrompt.match(/We spent three weeks/g)).toHaveLength(1);
  });
});
