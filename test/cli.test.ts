import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCli } from "../src/cli.js";
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
  it("provides help and version without an input file", () => {
    const help = capture();
    expect(runCli(["help"], help.io)).toBe(0);
    expect(help.output().stdout).toContain("develop <request.json>");

    const version = capture();
    expect(runCli(["version"], version.io)).toBe(0);
    expect(version.output().stdout.trim()).toBe(PACKAGE_VERSION);
  });

  it("lists frameworks and builds an LLM development contract", () => {
    const frameworks = capture();
    expect(runCli(["frameworks"], frameworks.io)).toBe(0);
    expect(JSON.parse(frameworks.output().stdout)).toHaveLength(9);

    const requestPath = fileURLToPath(new URL("../examples/requests/short-film.json", import.meta.url));
    const development = capture();
    expect(runCli(["develop", requestPath], development.io)).toBe(0);
    const contract = JSON.parse(development.output().stdout);
    expect(contract.framework.id).toBe("act-shot-master-spec");
    expect(contract.systemInstruction).toContain("surprising but inevitable");
    expect(contract.userBrief).toContain("AVOID CLICHES");
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
