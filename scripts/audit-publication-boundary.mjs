import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ignored = new Set([".git", "node_modules", "coverage"]);
const bannedExtensions = new Set([".mp4", ".mov", ".avi", ".wav", ".zip", ".jsonl"]);
const fragments = [
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

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    const relative = path.relative(root, full).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    const stat = fs.statSync(full);
    const extension = path.extname(entry.name).toLowerCase();
    if (bannedExtensions.has(extension)) errors.push(relative + ": banned evidence/media extension");
    if (stat.size > 500_000) errors.push(relative + ": file exceeds 500 KB publication ceiling");
    if (stat.size > 500_000) continue;
    const text = fs.readFileSync(full, "utf8");
    for (const fragment of fragments) {
      if (text.includes(fragment)) errors.push(relative + ": contains private-corpus marker");
    }
    for (const pattern of secretPatterns) {
      if (pattern.test(text)) errors.push(relative + ": contains credential-like material");
    }
  }
}

walk(root);
if (errors.length) {
  console.error(JSON.stringify({ passed: false, errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ passed: true, boundary: "framework-only", scannedRoot: path.basename(root) }, null, 2));
