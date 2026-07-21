#!/usr/bin/env node
import fs from "node:fs";
import { compilePacket } from "./compiler.js";
import { preflightPacket } from "./qc.js";
import { buildStoryboard } from "./storyboard.js";
import { parseUniversalPacket } from "./schemas.js";

const [command, inputPath, ...rest] = process.argv.slice(2);
const outIndex = rest.indexOf("--out");
const outputPath = outIndex >= 0 ? rest[outIndex + 1] : undefined;

if (!command || !inputPath || !["compile", "preflight", "storyboard", "validate"].includes(command)) {
  console.error("Usage: auteur-frameworks <compile|preflight|storyboard|validate> <packet.json> [--out result.json]");
  process.exit(2);
}

const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
let output: unknown;
if (command === "compile") output = compilePacket(input);
else if (command === "preflight") output = preflightPacket(parseUniversalPacket(input));
else if (command === "storyboard") output = buildStoryboard(input);
else output = parseUniversalPacket(input);

const serialized = JSON.stringify(output, null, 2) + "\n";
if (outputPath) fs.writeFileSync(outputPath, serialized, "utf8");
else process.stdout.write(serialized);
