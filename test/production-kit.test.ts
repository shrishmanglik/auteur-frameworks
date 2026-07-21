import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  UniversalPacketSchema,
  assessShotRoute,
  buildProductionKit,
} from "../src/index.js";

const example = JSON.parse(fs.readFileSync(new URL("../examples/product-film.json", import.meta.url), "utf8"));

describe("complete production kit", () => {
  it("projects one Universal Packet into every production deliverable", () => {
    const packet = UniversalPacketSchema.parse(example);
    const kit = buildProductionKit(packet);

    expect(kit).toMatchObject({
      kitVersion: "1.0.0",
      title: packet.metadata.title,
      creativeBrief: packet.metadata,
      story: packet.story,
    });
    expect(kit.scenePlan).toEqual(packet.scenes);
    expect(kit.storyboard).toHaveLength(packet.shots.length);
    expect(kit.shotList).toHaveLength(packet.shots.length);
    expect(kit.promptPackage.shots).toHaveLength(packet.shots.length);
    expect(kit.soundPlan[0]?.soundDesign).toContain("close liquid pour with a detailed glass resonance");
    expect(kit.styleBible.materials).toContain("hand-blown glass");
    expect(kit.continuityMatrix[0]?.locks).toContain("same tumbler geometry and rim thickness");
    expect(kit.repairCatalog.some((entry) => entry.code === "PERFORMANCE_EXAGGERATION")).toBe(true);
    expect(kit.exportManifest.deliverables).toContain("visual storyboard");
    expect(kit.preflight.passed).toBe(true);
  });

  it("makes high-risk route assets required in the manifest", () => {
    const packet = structuredClone(example);
    packet.shots[0].subject = "one bottle and one separate cap";
    packet.shots[0].action = "the cap lowers and seats on the bottle neck";
    packet.shots[0].beats[1].action = "the rigid cap crosses the gap and seats once";
    const kit = buildProductionKit(packet);

    expect(kit.shotList[0]?.route).toMatchObject({
      riskLevel: "high",
      recommendedMode: "first-last-frame",
      providerCapabilityStatus: "UNKNOWN",
    });
    expect(kit.assetManifest.some((asset) => asset.required && asset.type === "shot-reference")).toBe(true);
  });

  it("links character continuity only to shots that name the character or role", () => {
    const packet = structuredClone(example);
    packet.characters = [{
      id: "maker",
      name: "Nia",
      role: "glassmaker",
      identityLock: ["short silver hair"],
      wardrobeLock: ["indigo apron"],
    }];
    packet.shots[0].characterIds = ["maker"];
    packet.shots[0].subject = "Nia, a glassmaker, beside the hero tumbler";
    const kit = buildProductionKit(packet);
    expect(kit.continuityMatrix[0]?.characterLocks).toContain("Nia: short silver hair");
    expect(kit.assetManifest.find((asset) => asset.id === "character-maker")?.shotIds).toEqual(["shot-1"]);
    expect(kit.continuityMatrix[0]?.characterRelationshipStatus).toBe("RESOLVED");
  });

  it("preserves unresolved character ownership as UNKNOWN instead of guessing from prose", () => {
    const packet = structuredClone(example);
    packet.characters = [
      { id: "man", name: "Milo", role: "man", identityLock: ["dark curls"], wardrobeLock: [] },
      { id: "woman", name: "Wren", role: "woman", identityLock: ["silver braid"], wardrobeLock: [] },
    ];
    packet.shots[0].subject = "a woman checks the tumbler";
    packet.shots[0].characterIds = [];
    const kit = buildProductionKit(packet);
    expect(kit.continuityMatrix[0]?.characterRelationshipStatus).toBe("UNKNOWN");
    expect(kit.continuityMatrix[0]?.characterLocks).toEqual([]);
    expect(kit.preflight.issues.some((issue) => issue.code === "CHARACTER_RELATIONSHIP_UNKNOWN")).toBe(true);
  });

  it("keeps invalid explicit character ownership UNKNOWN", () => {
    const packet = structuredClone(example);
    packet.characters = [
      { id: "maker", name: "Nia", role: "glassmaker", identityLock: ["short silver hair"], wardrobeLock: [] },
    ];
    packet.shots[0].characterIds = ["missing-character"];
    const kit = buildProductionKit(packet);
    expect(kit.continuityMatrix[0]?.characterRelationshipStatus).toBe("UNKNOWN");
    expect(kit.continuityMatrix[0]?.characterLocks).toEqual([]);
    expect(kit.preflight.issues.some((issue) => issue.code === "UNKNOWN_CHARACTER")).toBe(true);
  });

  it("blocks duplicate character IDs without duplicating manifest asset IDs", () => {
    const packet = structuredClone(example);
    packet.characters = [
      { id: "maker", name: "Nia", role: "glassmaker", identityLock: ["short silver hair"], wardrobeLock: [] },
      { id: "maker", name: "Ari", role: "assistant", identityLock: ["round glasses"], wardrobeLock: [] },
    ];
    const kit = buildProductionKit(packet);
    expect(kit.preflight.passed).toBe(false);
    expect(kit.preflight.issues.some((issue) => issue.code === "DUPLICATE_CHARACTER_ID")).toBe(true);
    expect(kit.assetManifest.filter((asset) => asset.id === "character-maker")).toHaveLength(1);
  });

  it("requires the approved transcript even when exact dialogue stays text-only", () => {
    const packet = structuredClone(example);
    const shot = packet.shots[0];
    shot.subject = "one original presenter seated at a plain workbench";
    shot.action = "the presenter looks beside camera and speaks one exact sentence once";
    shot.physics = ["natural breathing and restrained facial motion"];
    shot.exclusions = ["no jump cuts", "no duplicated person"];
    shot.generationRisks = ["EXACT_DIALOGUE_AUDIO"];
    shot.dialogue = "Precision is mostly patience.";
    delete shot.onScreenText;
    const kit = buildProductionKit(packet);
    expect(kit.shotList[0]?.route.recommendedMode).toBe("text-only");
    const transcript = kit.assetManifest.find((asset) => asset.type === "audio");
    expect(transcript).toMatchObject({ required: true, shotIds: [shot.id] });
  });
});

describe("route advisor", () => {
  const baseShot = UniversalPacketSchema.parse(example).shots[0]!;

  it("routes exact fluid counts to split-pass verification", () => {
    const shot = structuredClone(baseShot);
    shot.physics = ["exactly three discrete droplets fall and create exactly three ripples"];
    const advice = assessShotRoute(shot);
    expect(advice.recommendedMode).toBe("split-pass");
    expect(advice.risks.some((risk) => risk.code === "EXACT_FLUID_COUNT")).toBe(true);
    expect(advice.acceptanceChecks.join(" ")).toContain("Count discrete fluid events");
  });

  it("routes causal contact choreography to first-last frames", () => {
    const shot = structuredClone(baseShot);
    shot.action = "a closing door contacts the rigid board, pivots it, and pins the worker";
    const advice = assessShotRoute(shot);
    expect(advice.recommendedMode).toBe("first-last-frame");
    expect(advice.requiredAssets).toContain("opening-state frame with the contact geometry visible");
  });

  it("never invents provider support for a recommended route", () => {
    const advice = assessShotRoute(baseShot);
    expect(advice.providerCapabilityStatus).toBe("UNKNOWN");
    expect(advice.providerCapabilityNote).toContain("Confirm");
  });

  it("does not turn ambiguous nouns into workflow requirements", () => {
    for (const action of [
      "a dinner plate slides across the table",
      "the passenger adjusts the car seat",
      "a contact lens rests in a sterile case",
    ]) {
      const shot = structuredClone(baseShot);
      shot.action = action;
      shot.physics = [action];
      shot.exclusions = ["no decorative typography or badges"];
      expect(assessShotRoute(shot).recommendedMode).toBe("text-only");
    }
  });

  it("honors an explicit structured risk marker without guessing provider support", () => {
    const shot = structuredClone(baseShot);
    shot.generationRisks = ["PRECISE_MECHANICAL_ASSEMBLY"];
    const advice = assessShotRoute(shot);
    expect(advice.recommendedMode).toBe("first-last-frame");
    expect(advice.providerCapabilityStatus).toBe("UNKNOWN");
  });
});
