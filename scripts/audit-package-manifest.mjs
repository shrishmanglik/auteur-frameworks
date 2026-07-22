import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const npmCli = process.env.npm_execpath;
const allowedRoots = ["dist/", "docs/", "examples/", "schemas/", "skills/", "src/"];
const allowedRootFiles = new Set([
  "CONTRIBUTING.md",
  "CHANGELOG.md",
  "CITATION.cff",
  "CODE_OF_CONDUCT.md",
  "GOVERNANCE.md",
  "LICENSE",
  "NOTICE",
  "README.md",
  "ROADMAP.md",
  "SECURITY.md",
  "SUPPORT.md",
  "llms.txt",
  "package.json",
]);
const requiredFiles = new Set([
  "dist/cli.js",
  "dist/index.d.ts",
  "dist/index.js",
  "dist/production-kit.js",
  "dist/route-advisor.js",
  "CITATION.cff",
  "docs/quickstart.md",
  "docs/production-kit.md",
  "docs/evidence/flow-rapid-matrix-2026-07-21.json",
  "docs/llm-integration.md",
  "examples/a-roll.json",
  "examples/product-film.json",
  "examples/short-film.json",
  "examples/vertical-reel.json",
  "GOVERNANCE.md",
  "llms.txt",
  "skills/auteur-flow-a-roll-validation/SKILL.md",
  "SUPPORT.md",
]);
const bannedExtensions = new Set([
  ".avi",
  ".jpeg",
  ".jpg",
  ".jsonl",
  ".mov",
  ".mp4",
  ".png",
  ".wav",
  ".zip",
]);
const privateFragments = [
  ["g", "en_01"].join(""),
  ["sora-data-files", "-export-"].join(""),
  ["auteur-render", "-distill"].join(""),
  ["worklist", ".jsonl"].join(""),
  ["evidence", "_gen_ids"].join(""),
  ["Million Dollar AI", " Studio\\\\"].join(""),
];
const secretPatterns = [
  /gh[pousr]_[A-Za-z0-9_]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const errors = [];

if (!npmCli || !fs.existsSync(npmCli)) {
  throw new Error("npm executable path is unavailable; run this audit through npm run audit:package");
}

const rawManifest = execFileSync(process.execPath, [npmCli, "pack", "--json", "--dry-run"], {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
const packResults = JSON.parse(rawManifest);
if (!Array.isArray(packResults) || packResults.length !== 1) {
  throw new Error("npm pack returned an unexpected manifest shape");
}

const packedFiles = packResults[0].files.map((entry) => ({
  path: entry.path.replaceAll("\\", "/"),
  size: entry.size,
}));
const packedPaths = new Set(packedFiles.map((entry) => entry.path));

for (const entry of packedFiles) {
  const allowed = allowedRootFiles.has(entry.path) || allowedRoots.some((prefix) => entry.path.startsWith(prefix));
  if (!allowed) errors.push(`${entry.path}: unexpected package path`);
  if (entry.size > 500_000) errors.push(`${entry.path}: file exceeds 500 KB publication ceiling`);
  if (bannedExtensions.has(path.extname(entry.path).toLowerCase())) {
    errors.push(`${entry.path}: banned evidence/media extension`);
  }

  const fullPath = path.join(root, entry.path);
  if (!fs.existsSync(fullPath)) {
    errors.push(`${entry.path}: listed by npm pack but missing on disk`);
    continue;
  }
  const text = fs.readFileSync(fullPath, "utf8");
  for (const fragment of privateFragments) {
    if (text.includes(fragment)) errors.push(`${entry.path}: contains private-corpus marker`);
  }
  for (const pattern of secretPatterns) {
    if (pattern.test(text)) errors.push(`${entry.path}: contains credential-like material`);
  }
}

for (const required of requiredFiles) {
  if (!packedPaths.has(required)) errors.push(`${required}: required package entrypoint is missing`);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const citation = fs.readFileSync(path.join(root, "CITATION.cff"), "utf8");
const citationVersion = citation.match(/^version:\s*([^\s]+)\s*$/m)?.[1];
const sourceVersion = fs.readFileSync(path.join(root, "src", "version.ts"), "utf8")
  .match(/PACKAGE_VERSION\s*=\s*"([^"]+)"/)?.[1];
if (citationVersion !== packageJson.version) {
  errors.push(`CITATION.cff: version ${citationVersion ?? "missing"} does not match package ${packageJson.version}`);
}
if (sourceVersion !== packageJson.version) {
  errors.push(`src/version.ts: version ${sourceVersion ?? "missing"} does not match package ${packageJson.version}`);
}

const license = fs.readFileSync(path.join(root, "LICENSE"), "utf8");
const licenseSha256 = crypto.createHash("sha256").update(license, "utf8").digest("hex");
const canonicalApache20Sha256 = "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30";
const normalizedLicense = license.replace(/\s+/g, " ");
const requiredLicenseClauses = [
  "1. Definitions.",
  "2. Grant of Copyright License.",
  "3. Grant of Patent License.",
  "4. Redistribution.",
  "5. Submission of Contributions.",
  "6. Trademarks.",
  "7. Disclaimer of Warranty.",
  "8. Limitation of Liability.",
  "9. Accepting Warranty or Additional Liability.",
  "If You institute patent litigation against any entity",
  "indemnify, defend, and hold each Contributor harmless",
  "END OF TERMS AND CONDITIONS",
  "APPENDIX: How to apply the Apache License to your work.",
];
if (Buffer.byteLength(license, "utf8") < 11_000) {
  errors.push("LICENSE: Apache-2.0 text is unexpectedly short");
}
if (licenseSha256 !== canonicalApache20Sha256) {
  errors.push("LICENSE: content does not match the pinned official Apache-2.0 text");
}
for (const clause of requiredLicenseClauses) {
  if (!normalizedLicense.includes(clause)) errors.push(`LICENSE: missing required clause: ${clause}`);
}

if (errors.length) {
  console.error(JSON.stringify({ passed: false, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  passed: true,
  package: packResults[0].filename,
  files: packedFiles.length,
  unpackedBytes: packResults[0].unpackedSize,
  boundary: "framework-only",
}, null, 2));
