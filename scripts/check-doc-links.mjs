import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const markdownFiles = [
  ...fs.readdirSync(root).filter((name) => name.endsWith(".md")),
  ...fs.readdirSync(path.join(root, "docs"))
    .filter((name) => name.endsWith(".md"))
    .map((name) => `docs/${name}`),
].sort();
const errors = [];
let linksChecked = 0;

for (const relative of markdownFiles) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  const pattern = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of source.matchAll(pattern)) {
    const target = match[1]?.trim();
    if (!target || /^(?:https?:|mailto:|#)/.test(target)) continue;
    const withoutAnchor = target.split("#", 1)[0];
    if (!withoutAnchor) continue;
    linksChecked += 1;
    const resolved = path.resolve(root, path.dirname(relative), decodeURIComponent(withoutAnchor));
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      errors.push(`${relative}: link escapes repository: ${target}`);
    } else if (!fs.existsSync(resolved)) {
      errors.push(`${relative}: missing local link target: ${target}`);
    }
  }
}

if (errors.length) {
  console.error(JSON.stringify({ passed: false, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ passed: true, markdownFiles: markdownFiles.length, linksChecked }, null, 2));
