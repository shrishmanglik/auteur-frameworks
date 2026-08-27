import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// The development contract hands an LLM three fields: systemInstruction, userBrief, and
// responseSchema. A caller that constrains generation with responseSchema cannot emit an
// invalid enum token. A caller that passes only the prose fields - which the README's own
// flow permits, since it says "send these three fields to the model or orchestration layer
// you control" - has to infer the token from the prose, and pays a repair round trip when
// it guesses wrong.
//
// This guard exists because that failure was measured, not imagined: a frontier model read
// the instruction sentence "frame-accurate audio/action synchronization" and emitted
// FRAME_ACCURATE_SYNC, which the packet parser rejected. The prose named the concept and
// never the token. Ten of the eleven generationRisk tokens were unnameable from the prose.
//
// The rule: every enum value the response schema will accept must appear verbatim in the
// system instruction, so the prose and the schema cannot drift apart silently.

const distPath = path.resolve("dist", "development.js");
const { buildDevelopmentContract } = await import(pathToFileURL(distPath).href);

const requestsDir = path.resolve("examples", "requests");
const requestFiles = fs.readdirSync(requestsDir).filter((name) => name.endsWith(".json"));
if (requestFiles.length === 0) {
  throw new Error("examples/requests contains no fixtures; the vocabulary guard cannot run");
}

const errors = [];
let totalTokensChecked = 0;

for (const file of requestFiles) {
  const request = JSON.parse(fs.readFileSync(path.join(requestsDir, file), "utf8"));
  const contract = buildDevelopmentContract(request);
  const schemaText = JSON.stringify(contract.responseSchema);

  // Enum values in this schema are SCREAMING_SNAKE_CASE; nothing else in the serialized
  // schema matches that shape.
  const tokens = [...new Set(
    [...schemaText.matchAll(/"([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)"/g)].map((match) => match[1]),
  )].sort();

  // A suspicious zero is a broken instrument until shown otherwise: if the extractor stops
  // matching, this guard would pass vacuously on every request.
  if (tokens.length === 0) {
    errors.push(`${file}: extracted 0 enum tokens from responseSchema; update the extractor in this script`);
    continue;
  }
  totalTokensChecked += tokens.length;

  const missing = tokens.filter((token) => !contract.systemInstruction.includes(token));
  if (missing.length) {
    errors.push(
      `${file}: systemInstruction never names ${missing.length} of ${tokens.length} accepted enum tokens `
        + `(${missing.join(", ")}). A caller that does not constrain generation with responseSchema must guess them.`,
    );
  }
}

if (errors.length) {
  for (const error of errors) process.stderr.write("AUTEUR_VOCABULARY_DRIFT: " + error + "\n");
  process.stderr.write(
    "ACTION: name each token verbatim in the system instruction built by src/development.ts.\n",
  );
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    passed: true,
    guard: "development contract vocabulary",
    requestsChecked: requestFiles.length,
    enumTokensChecked: totalTokensChecked,
  }));
}
