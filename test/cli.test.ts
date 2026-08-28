import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCli } from "../src/cli.js";
import { FRAMEWORKS } from "../src/frameworks.js";
import { PACKAGE_VERSION } from "../src/version.js";

const capture = () => {
  let stdout = "";
  let stderr = "";
  return {
    io: { stdout: (value: string) => { stdout += value; }, stderr: (value: string) => { stderr += value; } },
    output: () => ({ stdout, stderr }),
  };
};

describe("CLI", () => {
  it("keeps every value flag out of positional inputs, including for compare-renders", () => {
    // The flag registry is what stops a flag's value being read as a filename. compare-renders
    // takes TWO positionals and used to re-derive them with an --out-only filter, so an
    // unregistered flag's argument became the second input path. Fails on pre-fix source with
    // ENOENT on a file literally named "1".
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "auteur-cli-flags-"));
    try {
      const observation = (cycleId: string, score: number) => {
        const file = path.join(dir, `${cycleId}.json`);
        fs.writeFileSync(file, JSON.stringify({
          cycleId, packetVersion: "1.0.0", shotId: "shot-1",
          provider: "p", modelLabel: "m",
          scores: { promptAdherence: score, temporalCompletion: score, continuity: score,
            physicalMaterialRealism: score, cinematography: score, audio: score },
          evidenceNote: "synthetic fixture for a CLI argument test",
        }));
        return file;
      };
      const before = observation("before", 2);
      const after = observation("after", 4);

      const withFlag = capture();
      expect(runCli(["compare-renders", "--seed", "1", before, after], withFlag.io)).toBe(0);
      expect(withFlag.output().stderr).toBe("");
      expect(JSON.parse(withFlag.output().stdout).shotId).toBe("shot-1");

      // Control: the two forms that already worked must keep working.
      const plain = capture();
      expect(runCli(["compare-renders", before, after], plain.io)).toBe(0);
      expect(JSON.parse(plain.output().stdout).shotId).toBe("shot-1");

      const tooFew = capture();
      expect(runCli(["compare-renders", before], tooFew.io)).toBe(2);
      expect(tooFew.output().stderr).toContain("requires before and after");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("provides help and version without an input file", () => {
    const help = capture();
    expect(runCli(["help"], help.io)).toBe(0);
    expect(help.output().stdout).toContain("develop <request.json>");
    expect(help.output().stdout).toContain("kit <packet.json>");
    expect(help.output().stdout).toContain("plan-spoken <input.json>");
    expect(help.output().stdout).toContain("audit-edit <plan.json>");

    const version = capture();
    expect(runCli(["version"], version.io)).toBe(0);
    expect(version.output().stdout.trim()).toBe(PACKAGE_VERSION);
  });

  it("lists frameworks and builds an LLM development contract", () => {
    const frameworks = capture();
    expect(runCli(["frameworks"], frameworks.io)).toBe(0);
    expect(JSON.parse(frameworks.output().stdout)).toHaveLength(FRAMEWORKS.length);

    const requestPath = fileURLToPath(new URL("../examples/requests/short-film.json", import.meta.url));
    const development = capture();
    expect(runCli(["develop", requestPath], development.io)).toBe(0);
    const contract = JSON.parse(development.output().stdout);
    expect(contract.framework.id).toBe("act-shot-master-spec");
    expect(contract.systemInstruction).toContain("surprising but inevitable");
    expect(contract.userBrief).toContain("AVOID CLICHES");

    const continuationPath = fileURLToPath(new URL("../examples/continuation.json", import.meta.url));
    const continuation = capture();
    expect(runCli(["continue", continuationPath], continuation.io)).toBe(0);
    const continuationResult = JSON.parse(continuation.output().stdout);
    expect(continuationResult.prompt).toContain("BY 0.75s - FIRST MOTION");
    expect(continuationResult.prompt).toContain("Music: one restrained sub-bass pulse.");

    const packetPath = fileURLToPath(new URL("../examples/product-film.json", import.meta.url));
    const kit = capture();
    expect(runCli(["kit", packetPath], kit.io)).toBe(0);
    const kitResult = JSON.parse(kit.output().stdout);
    expect(kitResult.exportManifest.deliverables).toContain("visual storyboard");
    expect(kitResult.shotList[0].prompts.promptFidelity).toBe("FRAMEWORK_NATIVE");
    expect(kitResult.shotList[0].prompts.videoPrompt).toContain("PREMISE:");

    const spokenPath = fileURLToPath(new URL("../examples/spoken-clip-plan.json", import.meta.url));
    const spoken = capture();
    expect(runCli(["plan-spoken", spokenPath], spoken.io)).toBe(0);
    expect(JSON.parse(spoken.output().stdout).selectedDurationSeconds).toBe(6);

    const editPath = fileURLToPath(new URL("../examples/post-production-plan.json", import.meta.url));
    const edit = capture();
    expect(runCli(["audit-edit", editPath], edit.io)).toBe(0);
    expect(JSON.parse(edit.output().stdout).releaseDecision).toBe("ACCEPT");
  });

  it("confirms an --out write on stderr while keeping stdout machine-clean", () => {
    const packetPath = fileURLToPath(new URL("../examples/product-film.json", import.meta.url));
    const outPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "auteur-cli-")), "production-kit.json");
    const kit = capture();
    expect(runCli(["kit", packetPath, "--out", outPath], kit.io)).toBe(0);
    expect(kit.output().stdout).toBe("");
    expect(kit.output().stderr).toContain(`AUTEUR_OK: wrote ${outPath}`);
    const written = JSON.parse(fs.readFileSync(outPath, "utf8"));
    expect(written.exportManifest.deliverables).toContain("visual storyboard");
  });

  it("returns an actionable error for bad commands and malformed packets", () => {
    const unknown = capture();
    expect(runCli(["explode"], unknown.io)).toBe(2);
    expect(unknown.output().stderr).toContain("ACTION: Run auteur-frameworks help");

    const malformedPath = fileURLToPath(new URL("../package.json", import.meta.url));
    const malformed = capture();
    expect(fs.existsSync(malformedPath)).toBe(true);
    expect(runCli(["validate", malformedPath], malformed.io)).toBe(1);
    expect(malformed.output().stderr).toContain("ACTION: Correct the input");
  });
});
