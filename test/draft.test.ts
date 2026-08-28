import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ContentFormatSchema,
  DRAFT_LENS_COUNT,
  buildProductionKit,
  compilePacket,
  draftPacket,
  ideateConcepts,
  parseIdea,
  preflightPacket,
} from "../src/index.js";

const request = {
  idea: "On her last night shift before the tower is automated, a junior air traffic controller keeps receiving a callsign for a flight that landed safely thirty years ago.",
  format: "short-film" as const,
  targetDurationSeconds: 30,
  aspectRatio: "2.39:1" as const,
  audience: "adult drama viewers",
  tone: ["restrained", "procedural"],
};

describe("deterministic draft", () => {
  it("produces a byte-identical packet across repeated runs", () => {
    // Run three times, not two: one repeat cannot distinguish a stable result from a
    // cached one, and non-idempotency usually shows on the third call.
    const first = JSON.stringify(draftPacket(request).packet);
    const second = JSON.stringify(draftPacket(request).packet);
    const third = JSON.stringify(draftPacket(request).packet);
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it("changes the draft when the seed or the concept changes", () => {
    const base = JSON.stringify(draftPacket(request).packet);
    expect(JSON.stringify(draftPacket(request, { seed: 1 }).packet)).not.toBe(base);
    expect(JSON.stringify(draftPacket(request, { conceptIndex: 1 }).packet)).not.toBe(base);
    // A seed still has to be stable with itself, or "deterministic" means nothing.
    expect(JSON.stringify(draftPacket(request, { seed: 7 }).packet))
      .toBe(JSON.stringify(draftPacket(request, { seed: 7 }).packet));
  });

  it("reads no clock and no entropy", () => {
    // A source-level contract, because a single passing run cannot prove the absence of a
    // clock: two runs in the same millisecond would agree even with Date.now() inside.
    const source = fs.readFileSync(new URL("../src/draft.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/Date\.now|new Date\(/);
  });

  it("offers three distinct concepts drawn from the lens library", () => {
    const concepts = ideateConcepts(request);
    expect(concepts).toHaveLength(3);
    expect(new Set(concepts.map((concept) => concept.lens)).size).toBe(3);
    expect(DRAFT_LENS_COUNT).toBeGreaterThanOrEqual(3);
    for (const concept of concepts) {
      expect(concept.logline.length).toBeGreaterThan(20);
      expect(concept.twist.length).toBeGreaterThan(20);
    }
  });

  it("drafts a preflight-clean, kit-able packet for every public content format", () => {
    for (const format of ContentFormatSchema.options) {
      const { packet } = draftPacket({ ...request, format });
      const preflight = preflightPacket(packet);
      const errors = preflight.issues.filter((issue) => issue.severity === "error");
      expect(errors, `${format} preflight errors: ${JSON.stringify(errors)}`).toEqual([]);
      expect(preflight.passed, format).toBe(true);
      // The point of the bridge is that the packet feeds the rest of the toolkit, so
      // compiling and kitting it is part of the contract, not a separate concern.
      expect(() => compilePacket(packet), format).not.toThrow();
      const kit = buildProductionKit(packet);
      expect(kit.shotList.length, format).toBe(packet.shots.length);
    }
  });

  it("tiles every shot's beats across its full duration", () => {
    // This is the invariant preflight enforces as DURATION_MISMATCH. Pinning it here means
    // a beat-allocation regression fails in this file rather than as a downstream mystery.
    for (const format of ContentFormatSchema.options) {
      const { packet } = draftPacket({ ...request, format });
      let packetTotal = 0;
      for (const shot of packet.shots) {
        packetTotal += shot.durationSeconds;
        expect(shot.beats[0]?.startSeconds, `${format}/${shot.id}`).toBe(0);
        expect(shot.beats.at(-1)?.endSeconds, `${format}/${shot.id}`).toBe(shot.durationSeconds);
        shot.beats.forEach((beat, index) => {
          const previous = shot.beats[index - 1];
          if (previous) expect(beat.startSeconds, `${format}/${shot.id}`).toBe(previous.endSeconds);
        });
      }
      expect(packetTotal, format).toBe(packet.metadata.targetDurationSeconds);
    }
  });

  it("gives A-roll dialogue a spoken window so the A-roll contract holds", () => {
    // compileShot calls assertARollShotPerformance, which throws when an A-roll shot has
    // dialogue without a window. A draft that could not compile would be worthless.
    // hasDialogue must be asked for: it defaults to false in DevelopmentRequestSchema, and
    // the drafter deliberately writes no dialogue unless the request wants some.
    const { packet } = draftPacket({ ...request, format: "a-roll", hasDialogue: true });
    const spoken = packet.shots.filter((shot) => shot.dialogue ?? shot.audioTrack.spokenText);
    expect(spoken.length).toBeGreaterThan(0);
    for (const shot of spoken) {
      expect(shot.audioTrack.spokenWindow, shot.id).toBeDefined();
      expect(shot.audioTrack.spokenWindow!.endSeconds).toBeLessThanOrEqual(shot.durationSeconds);
    }
    expect(() => compilePacket(packet)).not.toThrow();
  });

  it("writes no dialogue unless the request asks for it", () => {
    // The toolkit should not put words in a production's mouth by default. Paired with the
    // A-roll test above, this pins both sides of the flag rather than only the happy path.
    const { packet } = draftPacket({ ...request, format: "a-roll" });
    expect(packet.shots.every((shot) => !shot.dialogue && !shot.audioTrack.spokenText)).toBe(true);
  });

  it("prefers a concrete noun over an inflected word when naming the subject", () => {
    // Regression on the first draft of this parser, which took the first content word and
    // titled the tower story "Night Shift Tower Automated" with the anchor "night".
    expect(parseIdea(request.idea).anchor).toBe("controller");
    expect(parseIdea("A hand-blown whisky tumbler is poured in one unbroken macro take.").anchor)
      .toBe("tumbler");
    expect(parseIdea("A retired locksmith is asked to open the last safe he ever built.").anchor)
      .toBe("locksmith");
  });

  it("honours the requested duration and never drafts a sub-two-second shot", () => {
    for (const seconds of [8, 12, 30, 90]) {
      const { packet } = draftPacket({ ...request, targetDurationSeconds: seconds });
      for (const shot of packet.shots) {
        expect(shot.durationSeconds, `${seconds}s target`).toBeGreaterThanOrEqual(2);
      }
      expect(packet.metadata.targetDurationSeconds).toBeGreaterThanOrEqual(Math.min(seconds, 8));
    }
  });
});
