import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// A detector that has never been shown to fail is a claim, not a check. This flips the
// compact-prompt spoken-line guard off in a throwaway copy of the built module and proves
// the bad input it rejects on the clean build is accepted once the guard is gone.

const distPath = path.resolve("dist", "compiler.js");
const mutationPath = path.resolve("dist", ".mutation-compact-spoken-line.mjs");
const source = fs.readFileSync(distPath, "utf8");
const marker = "const SPOKEN_LINE_SURVIVAL_GUARD = true;";
if (!source.includes(marker)) {
  throw new Error("mutation target missing; the compact-prompt spoken-line guard may have drifted");
}

const packet = JSON.parse(fs.readFileSync(path.resolve("examples", "short-film.json"), "utf8"));
const line = "Of course there is another floor.";
const shot = structuredClone(packet.shots[0]);
shot.dialogue = `Mara, under her breath: ${line}`;
// 2000 is a legal caller budget (the floor is 1000) at which compaction clips the audio
// section, so the approved line is truncated away.
const badBudget = { maxCharacters: 2000 };

const cleanModule = await import(pathToFileURL(distPath).href + `?clean=${Date.now()}`);

let cleanRejected = false;
try {
  cleanModule.compileCompactVideoPromptWithReport(shot, [], [], badBudget);
} catch {
  cleanRejected = true;
}
if (!cleanRejected) throw new Error("bad control did not fail before mutation");

// A clean control must also pass in the same run, or "rejected" could just mean "broken".
const cleanAccepted = cleanModule.compileCompactVideoPromptWithReport(shot, [], [], { maxCharacters: 10000 });
if (cleanAccepted.prompt.split(line).length !== 2) {
  throw new Error("clean control did not keep the approved spoken line exactly once");
}

fs.writeFileSync(mutationPath, source.replace(marker, "const SPOKEN_LINE_SURVIVAL_GUARD = false;"), "utf8");
let mutatedOccurrences = null;
try {
  const mutatedModule = await import(pathToFileURL(mutationPath).href + `?mutated=${Date.now()}`);
  const mutated = mutatedModule.compileCompactVideoPromptWithReport(shot, [], [], badBudget);
  mutatedOccurrences = mutated.prompt.split(line).length - 1;
} finally {
  fs.rmSync(mutationPath, { force: true });
}
if (mutatedOccurrences !== 0) {
  throw new Error("mutated build did not reproduce the silent spoken-line loss the guard exists to catch");
}

console.log(JSON.stringify({
  passed: true,
  detector: "compact prompt spoken-line survival guard",
  badControl: "rejected by clean build",
  cleanControl: "accepted by clean build with the line intact",
  mutation: "accepted after detector disabled, with the approved line present 0 times",
}));
