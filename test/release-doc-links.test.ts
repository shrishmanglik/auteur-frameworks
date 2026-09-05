import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const checker = fileURLToPath(new URL("../scripts/check-doc-links.mjs", import.meta.url));
const roots: string[] = [];

function fixture(git = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "auteur-release-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "docs"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ version: "0.11.0" }));
  fs.writeFileSync(path.join(root, "src", "frameworks.ts"), '    id: "synthetic",\n');
  fs.writeFileSync(path.join(root, "README.md"), [
    "![Frameworks: 1](https://img.shields.io/badge/frameworks-1-blue)",
    "npm install github:shrishmanglik/auteur-frameworks#v0.11.0",
    "## Frameworks", "| Framework |", "| --- |", "| Synthetic |", "",
  ].join("\n"));
  if (git) {
    runGit(root, "init");
    runGit(root, "-c", "user.name=Release Test", "-c", "user.email=release@example.invalid",
      "-c", "commit.gpgsign=false", "commit", "--allow-empty", "-m", "synthetic release");
  }
  return root;
}

function runGit(root: string, ...args: string[]) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
}

function check(root: string, release = true) {
  const result = spawnSync(process.execPath, [checker, ...(release ? ["--release"] : [])], {
    cwd: root, encoding: "utf8",
  });
  return { status: result.status, report: JSON.parse(result.status === 0 ? result.stdout : result.stderr) };
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("release documentation guard", () => {
  it("allows ordinary development but rejects an untagged release", () => {
    const root = fixture();
    expect(check(root, false).status).toBe(0);
    const result = check(root);
    expect(result.status).toBe(1);
    expect(result.report.errors).toContain("release: HEAD must have exact tag v0.11.0; git describe failed or returned no tag");
  });

  it("accepts the matching annotated tag on repeated checks", () => {
    const root = fixture();
    runGit(root, "-c", "user.name=Release Test", "-c", "user.email=release@example.invalid",
      "-c", "tag.gpgsign=false", "tag", "-a", "v0.11.0", "-m", "synthetic release");
    expect(check(root).status).toBe(0);
    expect(check(root).status).toBe(0);
  });

  it("rejects an exact tag for a different package version", () => {
    const root = fixture();
    runGit(root, "-c", "tag.gpgsign=false", "tag", "v0.10.0");
    const result = check(root);
    expect(result.status).toBe(1);
    expect(result.report.errors).toContain("release: HEAD is tagged v0.10.0, expected v0.11.0 from package.json");
  });

  it("fails closed without Git metadata", () => {
    expect(check(fixture(false)).status).toBe(1);
  });
});
