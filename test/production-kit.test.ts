import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  UniversalPacketSchema,
  assessShotConstraintBudget,
  assessShotRoute,
  buildProductionKit,
  preflightPacket,
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
    expect(kit.preflight.issues).toContainEqual(expect.objectContaining({ code: "OPENING_FRAME_STATE_FALLBACK" }));
    expect(kit.preflight.issues).toContainEqual(expect.objectContaining({ code: "TERMINAL_FRAME_STATE_FALLBACK" }));
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

  it("does not misclassify a wearable cap near a seated person as mechanical assembly", () => {
    const shot = structuredClone(baseShot);
    shot.subject = "a surgeon in scrubs walking toward a seated husband";
    shot.action = "the surgeon removes her cloth cap, walks three steps, and stops";
    shot.physics = ["the cloth cap folds naturally in one hand"];
    shot.continuityLocks = ["one cloth cap remains in her hand"];
    shot.beats = [
      { startSeconds: 0, endSeconds: 2, action: "she removes the cloth cap" },
      { startSeconds: 2, endSeconds: 6, action: "she walks toward the seated husband" },
      { startSeconds: 6, endSeconds: 8, action: "both people stop" },
    ];
    shot.generationRisks = [];
    shot.characterIds = [];
    shot.exclusions = ["no extra people"];
    delete shot.dialogue;
    delete shot.audioTrack.spokenText;
    delete shot.onScreenText;

    const advice = assessShotRoute(shot);
    expect(advice.risks.some((risk) => risk.code === "PRECISE_MECHANICAL_ASSEMBLY")).toBe(false);
    expect(advice.recommendedMode).toBe("text-only");
  });

  it("honors an explicit structured risk marker without guessing provider support", () => {
    const shot = structuredClone(baseShot);
    shot.generationRisks = ["PRECISE_MECHANICAL_ASSEMBLY"];
    const advice = assessShotRoute(shot);
    expect(advice.recommendedMode).toBe("first-last-frame");
    expect(advice.providerCapabilityStatus).toBe("UNKNOWN");
  });

  it("routes multi-subject dynamics and precise clearance without calling them assembly", () => {
    const shot = structuredClone(baseShot);
    shot.generationRisks = ["MULTI_SUBJECT_DYNAMICS", "PRECISE_SPATIAL_CLEARANCE"];
    const advice = assessShotRoute(shot);

    expect(advice.recommendedMode).toBe("first-last-frame");
    expect(advice.risks.map((risk) => risk.code)).toEqual([
      "MULTI_SUBJECT_DYNAMICS",
      "PRECISE_SPATIAL_CLEARANCE",
    ]);
    expect(advice.acceptanceChecks.join(" ")).toContain("Measure the declared terminal clearance");
  });

  it("adds a frame-accurate QC gate for synchronized sound and action", () => {
    const shot = structuredClone(baseShot);
    shot.generationRisks = ["AUDIO_ACTION_SYNCHRONIZATION"];
    const advice = assessShotRoute(shot);

    expect(advice.risks.map((risk) => risk.code)).toContain("AUDIO_ACTION_SYNCHRONIZATION");
    expect(advice.requiredAssets).toContain("approved action-to-audio cue sheet");
    expect(advice.acceptanceChecks.join(" ")).toContain("align at the intended frame");
  });

  it("fails closed when one short shot overloads delayed speech, staged action, surface control, and identity", () => {
    const packet = structuredClone(example);
    const shot = packet.shots[0];
    shot.durationSeconds = 8;
    shot.beats = [
      { startSeconds: 0, endSeconds: 2, action: "the vehicle remains closed" },
      { startSeconds: 2, endSeconds: 6, action: "the door opens and the performer exits" },
      { startSeconds: 6, endSeconds: 8, action: "the performer says the approved line once" },
    ];
    shot.dialogue = "Keep the meter running.";
    shot.audioTrack.spokenText = "Keep the meter running.";
    shot.audioTrack.spokenWindow = { startSeconds: 6, endSeconds: 8 };
    shot.generationRisks = ["EXACT_DIALOGUE_AUDIO", "IDENTITY_OR_PERFORMANCE", "BRAND_OR_TEXT_CONTROL"];

    const parsed = UniversalPacketSchema.parse(packet);
    const budget = assessShotConstraintBudget(parsed.shots[0]!);
    const advice = assessShotRoute(parsed.shots[0]!);
    const preflight = preflightPacket(parsed);

    expect(budget).toMatchObject({ score: 7, status: "overloaded" });
    expect(budget.factors.map((factor) => factor.code)).toEqual([
      "MULTI_STAGE_ACTION",
      "DELAYED_EXACT_DIALOGUE",
      "STRICT_SURFACE_CONTROL",
      "IDENTITY_LOCK",
    ]);
    expect(advice.recommendedMode).toBe("split-pass");
    expect(advice.risks.some((risk) => risk.code === "COMPOUND_CONSTRAINT_OVERLOAD")).toBe(true);
    expect(preflight.passed).toBe(false);
    expect(preflight.issues.some((issue) => issue.code === "SHOT_CONSTRAINT_OVERLOAD")).toBe(true);
  });

  it("keeps one immediate exact line inside the single-pass budget", () => {
    const shot = structuredClone(baseShot);
    shot.beats = [{ startSeconds: 0, endSeconds: 8, action: "the presenter delivers one line" }];
    shot.dialogue = "Precision is patience.";
    shot.audioTrack.spokenText = "Precision is patience.";
    shot.audioTrack.spokenWindow = { startSeconds: 0, endSeconds: 8 };
    shot.generationRisks = ["EXACT_DIALOGUE_AUDIO", "IDENTITY_OR_PERFORMANCE"];

    expect(assessShotConstraintBudget(shot)).toMatchObject({ score: 1, status: "within-budget" });
    expect(assessShotRoute(shot).recommendedMode).toBe("reference-first");
  });
});
