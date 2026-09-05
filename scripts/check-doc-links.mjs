import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

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

// Framework-count drift guard.
// The README badge, the README framework table, and the FRAMEWORKS registry must agree.
// The badge is the first thing a visitor reads, so a stale number there is a public defect.
const frameworkSource = fs.readFileSync(path.join(root, "src", "frameworks.ts"), "utf8");
const registryCount = [...frameworkSource.matchAll(/^ {4}id: "/gm)].length;

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const badgeMatch = readme.match(/!\[Frameworks: (\d+)\]\(https:\/\/img\.shields\.io\/badge\/frameworks-(\d+)-/);

if (registryCount === 0) {
  errors.push("frameworks.ts: could not count registry entries; update the drift guard in check-doc-links.mjs");
} else if (!badgeMatch) {
  errors.push("README.md: framework count badge not found or its format changed");
} else {
  const [, badgeLabel, badgeValue] = badgeMatch;
  if (badgeLabel !== badgeValue) {
    errors.push(`README.md: framework badge label (${badgeLabel}) and image value (${badgeValue}) disagree`);
  }
  if (Number(badgeValue) !== registryCount) {
    errors.push(
      `README.md: framework badge says ${badgeValue} but src/frameworks.ts defines ${registryCount} frameworks`
    );
  }

  // Bound the section at the next h2 so later tables in the README are not counted.
  const afterHeading = readme.split(/^## Frameworks$/m)[1] ?? "";
  const tableSection = afterHeading.split(/^## /m)[0] ?? "";
  const tableRows = [...tableSection.matchAll(/^\| (?!---)(?!Framework \|)/gm)].length;
  if (tableRows !== registryCount) {
    errors.push(
      `README.md: framework table lists ${tableRows} rows but src/frameworks.ts defines ${registryCount} frameworks`
    );
  }
}


// Release-pin drift guard.
// The docs tell a reader to install an immutable tag. If package.json moves and no matching
// tag is cut, that instruction silently hands out an older package: before v0.10.0 existed,
// the README documented plan-spoken and audit-edit while pinning v0.9.1, which does not have
// them. This does not prove the tag exists on the remote - that needs a network call - it
// proves the docs and package.json agree on which version a reader is being sent to.
const pkgVersion = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const pinFiles = ["README.md", "llms.txt", path.join("docs", "quickstart.md"), path.join("docs", "llm-integration.md")];
let pinsChecked = 0;
for (const relative of pinFiles) {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, "utf8");
  for (const match of text.matchAll(/auteur-frameworks#v([0-9][0-9A-Za-z.\-]*)/g)) {
    pinsChecked += 1;
    if (match[1] !== pkgVersion) {
      errors.push(
        `${relative}: install pin names v${match[1]} but package.json is ${pkgVersion}; ` +
        "cut the matching tag or correct the pin"
      );
    }
  }
}
// A suspicious zero is a broken instrument until shown otherwise: if the pattern stops
// matching, this guard would pass vacuously while the pins rot.
if (pinsChecked === 0) {
  errors.push("no install pins found in the documented surfaces; update the pin guard in check-doc-links.mjs");
}

// Normal development may be ahead of the last release. At publication, the local
// tag must identify this exact commit; remote existence still needs release readback.
if (process.argv.includes("--release")) {
  const expectedTag = `v${pkgVersion}`;
  const described = spawnSync("git", ["describe", "--tags", "--exact-match", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  });
  const actualTag = described.stdout?.trim();
  if (described.error || described.status !== 0 || !actualTag) {
    errors.push(`release: HEAD must have exact tag ${expectedTag}; git describe failed or returned no tag`);
  } else if (actualTag !== expectedTag) {
    errors.push(`release: HEAD is tagged ${actualTag}, expected ${expectedTag} from package.json`);
  }
}

if (errors.length) {
  console.error(JSON.stringify({ passed: false, errors }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    { passed: true, markdownFiles: markdownFiles.length, linksChecked, frameworkCount: registryCount, pinsChecked, releaseVersion: pkgVersion },
    null,
    2
  )
);
