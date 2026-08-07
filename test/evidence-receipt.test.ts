import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Source = {
  id: string;
  sourceClass: string;
  sha256: string;
  disclosure: string;
};

type Observation = {
  id: string;
  status: string;
  sourceRefs: string[];
};

const receipt = JSON.parse(
  readFileSync("docs/evidence/bwz-production-distillation-2026-08-06.json", "utf8"),
) as { sourceRegistry: Source[]; observations: Observation[] };

describe("sanitized production evidence receipt", () => {
  it("terminates every observation in registered immutable evidence digests", () => {
    const sources = new Map(receipt.sourceRegistry.map((source) => [source.id, source]));

    expect(sources.size).toBe(receipt.sourceRegistry.length);
    expect(receipt.observations.length).toBeGreaterThan(0);

    for (const observation of receipt.observations) {
      expect(observation.sourceRefs.length, `${observation.id} has no source`).toBeGreaterThan(0);
      for (const sourceRef of observation.sourceRefs) {
        const source = sources.get(sourceRef);
        expect(source, `${observation.id} has unresolved source ${sourceRef}`).toBeDefined();
        expect(source?.sourceClass).toMatch(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
        expect(source?.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(source?.disclosure).toBe("digest-only");
      }
    }
  });

  it("fails the known-bad adjacent control with a prose-only observation", () => {
    const bad = structuredClone(receipt);
    bad.observations[0].sourceRefs = [];

    const unresolved = bad.observations.filter((observation) =>
      observation.sourceRefs.length === 0 ||
      observation.sourceRefs.some((sourceRef) =>
        !bad.sourceRegistry.some((source) => source.id === sourceRef)
      )
    );

    expect(unresolved.map((observation) => observation.id)).toContain("BWZ-D01");
  });
});
