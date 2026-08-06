import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const distPath = path.resolve("dist", "post-production.js");
const mutationPath = path.resolve("dist", ".mutation-post-production.mjs");
const source = fs.readFileSync(distPath, "utf8");
const marker = "const BROLL_CONCEALMENT_GUARD = true;";
if (!source.includes(marker)) {
  throw new Error("mutation target missing; the B-roll concealment detector may have drifted");
}

const cleanModule = await import(pathToFileURL(distPath).href + `?clean=${Date.now()}`);
const fixture = JSON.parse(fs.readFileSync(path.resolve("examples", "post-production-plan.json"), "utf8"));
fixture.bRoll[0].concealsMaterialARollFailure = true;

let cleanRejected = false;
try {
  cleanModule.PostProductionPlanSchema.parse(fixture);
} catch {
  cleanRejected = true;
}
if (!cleanRejected) throw new Error("bad control did not fail before mutation");

fs.writeFileSync(mutationPath, source.replace(marker, "const BROLL_CONCEALMENT_GUARD = false;"), "utf8");
try {
  const mutatedModule = await import(pathToFileURL(mutationPath).href + `?mutated=${Date.now()}`);
  mutatedModule.PostProductionPlanSchema.parse(fixture);
} finally {
  fs.rmSync(mutationPath, { force: true });
}

console.log(JSON.stringify({
  passed: true,
  detector: "B-roll concealment guard",
  badControl: "rejected by clean build",
  mutation: "accepted after detector disabled",
}));
