import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const npmCli = process.env.npm_execpath;
if (!npmCli || !fs.existsSync(npmCli)) {
  throw new Error("npm executable path is unavailable; run through npm run test:consumer");
}

const runNpm = (args, cwd) => execFileSync(process.execPath, [npmCli, ...args], {
  cwd,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "auteur-frameworks-consumer-"));

try {
  const pack = JSON.parse(runNpm(["pack", "--json", "--pack-destination", temp], root));
  const tarball = path.join(temp, pack[0].filename);
  fs.writeFileSync(path.join(temp, "package.json"), JSON.stringify({
    name: "auteur-frameworks-consumer-smoke",
    private: true,
    type: "module",
  }, null, 2));
  runNpm(["install", "--ignore-scripts", "--no-audit", tarball], temp);

  const importProof = execFileSync(process.execPath, [
    "--input-type=module",
    "-e",
    "import { FRAMEWORKS, compilePacket, buildDevelopmentContract, compileContinuationPrompt } from 'auteur-frameworks'; if (FRAMEWORKS.length !== 10 || typeof compilePacket !== 'function' || typeof buildDevelopmentContract !== 'function' || typeof compileContinuationPrompt !== 'function') process.exit(1); console.log(FRAMEWORKS.length);",
  ], { cwd: temp, encoding: "utf8" }).trim();

  const cli = path.join(temp, "node_modules", "auteur-frameworks", "dist", "cli.js");
  const installedRoot = path.join(temp, "node_modules", "auteur-frameworks");
  const example = path.join(installedRoot, "examples", "product-film.json");
  const help = execFileSync(process.execPath, [cli, "help"], { cwd: temp, encoding: "utf8" });
  const compiled = JSON.parse(execFileSync(process.execPath, [cli, "compile", example], { cwd: temp, encoding: "utf8" }));

  if (!help.includes("develop <request.json>") || !help.includes("continue <input.json>") || compiled.shots.length !== 1 || !compiled.preflight.passed) {
    throw new Error("Packed CLI smoke returned an unexpected result");
  }

  const readme = fs.readFileSync(path.join(installedRoot, "README.md"), "utf8");
  const continuationSchema = path.join(installedRoot, "schemas", "continuation-input.schema.json");
  if (!fs.existsSync(continuationSchema)) throw new Error("Packed continuation JSON Schema is missing");
  const localLinks = [...readme.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)]
    .map((match) => match[1]?.trim())
    .filter((target) => target && !/^(?:https?:|mailto:|#)/.test(target));
  const missingLinks = localLinks.filter((target) => {
    const withoutAnchor = target.split("#", 1)[0];
    return withoutAnchor && !fs.existsSync(path.resolve(installedRoot, decodeURIComponent(withoutAnchor)));
  });
  if (missingLinks.length) {
    throw new Error("Packed README contains missing local links: " + missingLinks.join(", "));
  }

  console.log(JSON.stringify({
    passed: true,
    frameworks: Number(importProof),
    compiledShots: compiled.shots.length,
    packedReadmeLinks: localLinks.length,
  }));
} finally {
  const resolved = path.resolve(temp);
  const tempRoot = path.resolve(os.tmpdir()) + path.sep;
  if (!resolved.startsWith(tempRoot)) throw new Error("Refusing to clean a path outside the OS temp directory");
  fs.rmSync(resolved, { recursive: true, force: true });
}
