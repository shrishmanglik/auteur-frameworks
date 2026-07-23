import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  UniversalPacketSchema,
  assessShotConstraintBudget,
  assessShotRoute,
  buildDelayedRevealSplitPlan,
  buildProductionKit,
  preflightPacket,
  terminalOnlyVisibleInventory,
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

  it("routes delayed terminal inventory to a lexically isolated split", () => {
    const shot = structuredClone(baseShot);
    shot.intent = "build dread before revealing the bronze bell";
    shot.frameStates = {
      opening: {
        subject: "one diver with one lamp",
        action: "the diver enters a timber gap",
        environment: "green water and occluding timber",
        visibleInventory: ["one diver", "one lamp", "one timber gap"],
        paletteBase: ["cold green", "weathered timber"],
        materials: ["waterlogged timber", "black drysuit fabric"],
        imperfectionAnchors: ["uneven silt density"],
        continuityLocks: ["same diver gear"],
      },
      terminal: {
        subject: "the same diver with the same lamp",
        action: "the lamp reveals one attached bell",
        environment: "green water beside an attached bronze bell",
        visibleInventory: ["one diver", "one lamp", "one attached bronze bell"],
        paletteBase: ["cold green", "aged bronze"],
        materials: ["waterlogged timber", "oxidized bronze"],
        imperfectionAnchors: ["biofouling on the bell edge"],
        continuityLocks: ["same diver gear", "bell stays attached"],
      },
    };

    const advice = assessShotRoute(shot);
    expect(advice.recommendedMode).toBe("split-pass");
    expect(advice.risks).toContainEqual(expect.objectContaining({ code: "DELAYED_TERMINAL_REVEAL", level: "high" }));
    expect(advice.requiredAssets).toContain("accepted pre-reveal final frame for render-observed continuation compilation");
    expect(advice.acceptanceChecks).toContain("Reject a pre-reveal pass whose prompt or pixels expose terminal-only inventory.");

    const plan = buildDelayedRevealSplitPlan(shot, [], [], {
      productionTitle: "The bronze bell",
      storyLogline: "A diver discovers a bronze bell inside a wreck.",
      scenePurpose: "Reveal the bell only at the end.",
    });
    expect(plan.mode).toBe("split-pass");
    expect(plan.terminalOnlyInventory).toEqual(["one attached bronze bell"]);
    expect(plan.preReveal.lexicalAudit).toMatchObject({ passed: true, matches: [] });
    expect(plan.preReveal.prompts.promptFidelity).toBe("FRAMEWORK_NATIVE");
    expect(plan.preReveal.prompts.videoPrompt).not.toMatch(/bell|bronze/i);
    expect(plan.preReveal.prompts.compactVideoPrompt).not.toMatch(/bell|bronze/i);
    expect(plan.preReveal.prompts.openingFramePrompt).not.toMatch(/bell|bronze/i);
    expect(plan.preReveal.prompts.terminalFramePrompt).not.toMatch(/bell|bronze/i);
    expect(plan.preReveal.prompts.audioPrompt).not.toMatch(/bell|bronze/i);
    expect(plan.preReveal.prompts.negativePrompt).not.toMatch(/bell|bronze/i);
    expect(plan.revealContinuation.status).toBe("REQUIRES_RENDER_OBSERVED_FINAL_FRAME");
    expect(plan.revealContinuation.targetFramePrompt).toContain("one attached bell");
    expect(preflightPacket({
      ...structuredClone(example),
      shots: [shot],
    }).issues).toContainEqual(expect.objectContaining({
      code: "DELAYED_REVEAL_SINGLE_PASS_BLOCKED",
      severity: "error",
    }));
  });

  it("does not mistake material wording changes for new terminal inventory", () => {
    const shot = structuredClone(baseShot);
    shot.frameStates = {
      opening: {
        subject: "one diver",
        action: "the diver enters",
        environment: "green water",
        visibleInventory: ["one diver", "one right-hand lamp", "two plain brushed-metal tanks"],
        paletteBase: ["cold green"],
        materials: ["black neoprene", "brushed metal"],
        imperfectionAnchors: ["uneven silt"],
        continuityLocks: ["same diver gear"],
      },
      terminal: {
        subject: "the same diver",
        action: "the lamp reveals one attached bronze bell",
        environment: "green water",
        visibleInventory: ["one diver", "one lamp", "two plain tanks", "one attached bronze bell"],
        paletteBase: ["cold green", "aged bronze"],
        materials: ["black neoprene", "oxidized bronze"],
        imperfectionAnchors: ["uneven silt"],
        continuityLocks: ["same diver gear"],
      },
    };

    const plan = buildDelayedRevealSplitPlan(shot);
    expect(plan.terminalOnlyInventory).toEqual(["one attached bronze bell"]);
    expect(plan.preReveal.lexicalAudit.forbiddenTerms).toEqual(expect.arrayContaining(["bronze", "bell"]));
    expect(plan.preReveal.lexicalAudit.forbiddenTerms).not.toContain("tanks");
  });

  it("treats an explicitly additional object as new even when its head noun already exists", () => {
    const shot = structuredClone(baseShot);
    shot.frameStates = {
      opening: {
        subject: "one diver",
        action: "the diver waits",
        environment: "green water",
        visibleInventory: ["one diver", "two plain brushed-metal tanks"],
        paletteBase: ["cold green"],
        materials: ["black neoprene", "brushed metal"],
        imperfectionAnchors: ["uneven silt"],
        continuityLocks: ["same diver gear"],
      },
      terminal: {
        subject: "the same diver",
        action: "one additional oxygen tank enters beside the diver",
        environment: "green water",
        visibleInventory: ["one diver", "two plain tanks", "one additional oxygen tank"],
        paletteBase: ["cold green"],
        materials: ["black neoprene", "brushed metal"],
        imperfectionAnchors: ["uneven silt"],
        continuityLocks: ["same diver gear"],
      },
    };

    expect(terminalOnlyVisibleInventory(shot)).toEqual(["one additional oxygen tank"]);
  });

  it("keeps the same counted object when only descriptive state changes", () => {
    const shot = structuredClone(baseShot);
    shot.frameStates = {
      opening: {
        subject: "one worker",
        action: "the worker faces a closed door",
        environment: "plain corridor",
        visibleInventory: ["one worker", "one red steel door"],
        paletteBase: ["neutral gray", "red"],
        materials: ["painted steel"],
        imperfectionAnchors: ["small paint scuffs"],
        continuityLocks: ["same worker and door geometry"],
      },
      terminal: {
        subject: "the same worker",
        action: "blue light crosses the same closed door",
        environment: "the same corridor",
        visibleInventory: ["one worker", "one blue steel door"],
        paletteBase: ["neutral gray", "blue"],
        materials: ["painted steel"],
        imperfectionAnchors: ["same paint scuffs"],
        continuityLocks: ["same worker and door geometry"],
      },
    };

    expect(terminalOnlyVisibleInventory(shot)).toEqual([]);
  });

  it("accounts for same-head inventory as a multiset and identifies the added instance", () => {
    const shot = structuredClone(baseShot);
    shot.frameStates = {
      opening: {
        subject: "one technician",
        action: "the technician waits beside a table lamp",
        environment: "a plain workshop",
        visibleInventory: ["one technician", "one table lamp"],
        paletteBase: ["neutral gray"],
        materials: ["painted steel"],
        imperfectionAnchors: ["small workbench scratches"],
        continuityLocks: ["same technician and workshop"],
      },
      terminal: {
        subject: "the same technician",
        action: "a diving lamp is placed beside the table lamp",
        environment: "the same workshop",
        visibleInventory: ["one technician", "one table lamp", "one diving lamp"],
        paletteBase: ["neutral gray"],
        materials: ["painted steel"],
        imperfectionAnchors: ["same workbench scratches"],
        continuityLocks: ["same technician and workshop"],
      },
    };

    expect(terminalOnlyVisibleInventory(shot)).toEqual(["one diving lamp"]);
    expect(assessShotRoute(shot).recommendedMode).toBe("split-pass");
  });

  it("ignores post-nominal appearance changes when object count and head stay fixed", () => {
    const shot = structuredClone(baseShot);
    shot.frameStates = {
      opening: {
        subject: "one worker",
        action: "the worker faces a closed door",
        environment: "plain corridor",
        visibleInventory: ["one worker", "one steel door painted red"],
        paletteBase: ["neutral gray", "red"],
        materials: ["painted steel"],
        imperfectionAnchors: ["small paint scuffs"],
        continuityLocks: ["same worker and door geometry"],
      },
      terminal: {
        subject: "the same worker",
        action: "blue light crosses the same closed door",
        environment: "the same corridor",
        visibleInventory: ["one worker", "one steel door painted blue"],
        paletteBase: ["neutral gray", "blue"],
        materials: ["painted steel"],
        imperfectionAnchors: ["same paint scuffs"],
        continuityLocks: ["same worker and door geometry"],
      },
    };

    expect(terminalOnlyVisibleInventory(shot)).toEqual([]);
  });

  it("blocks singular and plural forms of terminal-only inventory across every prompt surface", () => {
    const shot = structuredClone(baseShot);
    shot.intent = "delay the bronze bells until the final state";
    shot.camera.movement = "move toward one bell without changing axis";
    shot.generationRisks = ["DELAYED_TERMINAL_REVEAL"];
    shot.frameStates = {
      opening: {
        subject: "one diver with one lamp",
        action: "the diver enters a timber gap",
        environment: "green water and occluding timber",
        visibleInventory: ["one diver", "one lamp", "one timber gap"],
        paletteBase: ["cold green", "weathered timber"],
        materials: ["waterlogged timber", "black drysuit fabric"],
        imperfectionAnchors: ["uneven silt density"],
        continuityLocks: ["same diver gear"],
      },
      terminal: {
        subject: "the same diver with the same lamp",
        action: "the lamp reaches two bronze bells",
        environment: "green water beside two bronze bells",
        visibleInventory: ["one diver", "one lamp", "two bronze bells"],
        paletteBase: ["cold green", "aged bronze"],
        materials: ["waterlogged timber", "oxidized bronze"],
        imperfectionAnchors: ["biofouling on both bells"],
        continuityLocks: ["same diver gear", "both bells stay attached"],
      },
    };

    const plan = buildDelayedRevealSplitPlan(shot);
    const preRevealSurfaces = [
      plan.preReveal.prompts.videoPrompt,
      plan.preReveal.prompts.compactVideoPrompt,
      plan.preReveal.prompts.openingFramePrompt,
      plan.preReveal.prompts.terminalFramePrompt,
      plan.preReveal.prompts.framePrompt,
      plan.preReveal.prompts.audioPrompt ?? "",
      plan.preReveal.prompts.negativePrompt,
    ].join("\n");

    expect(plan.preReveal.lexicalAudit.forbiddenTerms).toEqual(expect.arrayContaining(["bell", "bells"]));
    expect(plan.preReveal.lexicalAudit.passed).toBe(true);
    expect(preRevealSurfaces).not.toMatch(/\bbells?\b/i);
  });

  it("normalizes irregular terminal nouns without treating persistence prose as a leak", () => {
    const shot = structuredClone(baseShot);
    shot.intent = "withhold two knives until the final state";
    shot.camera.framing = "keep the singular knife position outside the opening crop";
    shot.generationRisks = ["DELAYED_TERMINAL_REVEAL"];
    shot.frameStates = {
      opening: {
        subject: "one chef at a workbench",
        action: "the chef waits with both hands visible",
        environment: "a plain prep kitchen",
        visibleInventory: ["one chef", "one workbench"],
        paletteBase: ["neutral steel", "soft white"],
        materials: ["brushed steel", "worn wood"],
        imperfectionAnchors: ["small workbench scratches"],
        continuityLocks: ["same chef and workbench"],
      },
      terminal: {
        subject: "the same chef at the same workbench",
        action: "the chef opens a drawer containing two knives",
        environment: "the same prep kitchen beside an open drawer",
        visibleInventory: ["one chef", "one workbench", "two knives"],
        paletteBase: ["neutral steel", "soft white"],
        materials: ["brushed steel", "worn wood"],
        imperfectionAnchors: ["same workbench scratches"],
        continuityLocks: ["same chef and workbench", "both knives remain inside the drawer"],
      },
    };

    const plan = buildDelayedRevealSplitPlan(shot);
    const preRevealSurfaces = [
      plan.preReveal.prompts.videoPrompt,
      plan.preReveal.prompts.compactVideoPrompt,
      plan.preReveal.prompts.openingFramePrompt,
      plan.preReveal.prompts.terminalFramePrompt,
      plan.preReveal.prompts.audioPrompt ?? "",
      plan.preReveal.prompts.negativePrompt,
    ].join("\n");

    expect(plan.preReveal.lexicalAudit.forbiddenTerms).toEqual(expect.arrayContaining(["knife", "knives"]));
    expect(plan.preReveal.lexicalAudit.forbiddenTerms).not.toContain("remains");
    expect(plan.preReveal.lexicalAudit.passed).toBe(true);
    expect(preRevealSurfaces).not.toMatch(/\b(?:knife|knives)\b/i);
  });

  it("does not confuse generic framework verbs with leaked terminal-object language", () => {
    const shot = structuredClone(baseShot);
    shot.generationRisks = ["DELAYED_TERMINAL_REVEAL"];
    shot.camera.optics.lensModel = "Bell Prime";
    shot.frameStates = {
      opening: {
        subject: "one diver with one lamp",
        action: "the diver enters a timber gap",
        environment: "green water and occluding timber",
        visibleInventory: ["one diver", "one lamp", "one timber gap"],
        paletteBase: ["cold green", "weathered timber"],
        materials: ["waterlogged timber", "black drysuit fabric"],
        imperfectionAnchors: ["uneven silt density"],
        continuityLocks: ["same diver gear"],
      },
      terminal: {
        subject: "the same diver with the same lamp",
        action: "a new bell appears beyond the timber gap",
        environment: "green water beside one bronze bell",
        visibleInventory: ["one diver", "one lamp", "one bronze bell"],
        paletteBase: ["cold green", "aged bronze"],
        materials: ["waterlogged timber", "oxidized bronze"],
        imperfectionAnchors: ["biofouling on the bell edge"],
        continuityLocks: ["same diver gear", "the bell stays attached"],
      },
    };

    const plan = buildDelayedRevealSplitPlan(shot);
    expect(plan.preReveal.lexicalAudit.passed).toBe(true);
    expect(plan.preReveal.lexicalAudit.matches).toEqual([]);
    expect(plan.preReveal.prompts.videoPrompt).not.toMatch(/Bell Prime/i);
    expect(plan.preReveal.prompts.openingFramePrompt).not.toMatch(/Bell Prime/i);
    expect(plan.preReveal.shot.camera.optics.lensModel).toBe("provider-neutral cinema lens");
    expect(plan.preReveal.lexicalAudit.forbiddenTerms).not.toEqual(expect.arrayContaining([
      "new",
      "appear",
      "appears",
    ]));
  });

  it("builds an explicit relationship reveal without requiring new terminal inventory", () => {
    const packet = structuredClone(example);
    const shot = packet.shots[0];
    shot.intent = "hold emotional restraint until the daughter recognizes her father";
    shot.subject = "one adult woman and one older man seated across a table";
    shot.action = "the woman studies the man, recognizes her father, then reaches toward his hand";
    shot.environment = "a quiet family kitchen at night";
    shot.beats = [
      { startSeconds: 0, endSeconds: 4, action: "the woman studies the man across the table" },
      { startSeconds: 4, endSeconds: 8, action: "the woman recognizes her father and reaches toward his hand" },
    ];
    shot.physics = ["natural breathing and restrained hand movement"];
    shot.continuityLocks = ["same two people", "same table geometry", "same screen direction"];
    shot.generationRisks = ["DELAYED_TERMINAL_REVEAL"];
    shot.dialogue = undefined;
    shot.onScreenText = undefined;
    shot.audioTrack = { soundDesignDirectives: ["quiet room tone"] };
    shot.frameStates = {
      opening: {
        subject: "one adult woman and one older man",
        action: "the woman studies the man across the table without recognition",
        environment: "a quiet family kitchen at night",
        visibleInventory: ["one woman", "one man", "one table"],
        paletteBase: ["neutral tungsten", "muted blue"],
        materials: ["worn wood", "cotton clothing"],
        imperfectionAnchors: ["faint skin texture", "small table scratches"],
        continuityLocks: ["same two people", "same table geometry", "same screen direction"],
      },
      terminal: {
        subject: "the same adult woman and older man",
        action: "the woman recognizes the man as her father and reaches toward his hand",
        environment: "the same quiet family kitchen at night",
        visibleInventory: ["one woman", "one man", "one table"],
        paletteBase: ["neutral tungsten", "muted blue"],
        materials: ["worn wood", "cotton clothing"],
        imperfectionAnchors: ["faint skin texture", "small table scratches"],
        continuityLocks: ["same two people", "same table geometry", "same screen direction"],
      },
    };

    const plan = buildDelayedRevealSplitPlan(shot);
    const preRevealSurfaces = [
      plan.preReveal.prompts.videoPrompt,
      plan.preReveal.prompts.compactVideoPrompt,
      plan.preReveal.prompts.openingFramePrompt,
      plan.preReveal.prompts.terminalFramePrompt,
      plan.preReveal.prompts.audioPrompt ?? "",
      plan.preReveal.prompts.negativePrompt,
    ].join("\n");

    expect(plan.terminalOnlyInventory).toEqual([]);
    expect(plan.preReveal.lexicalAudit.passed).toBe(true);
    expect(preRevealSurfaces).not.toMatch(/father|recognizes|recognition/i);
    expect(plan.preReveal.shot.dialogue).toBeUndefined();
    expect(plan.preReveal.shot.audioTrack.spokenText).toBeUndefined();
    expect(plan.preReveal.shot.audioTrack.spokenWindow).toBeUndefined();
    expect(plan.preReveal.shot.onScreenText).toBeUndefined();
    expect(() => buildProductionKit(packet)).not.toThrow();
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
