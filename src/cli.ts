#!/usr/bin/env node
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { ZodError } from "zod";
import { compilePacket } from "./compiler.js";
import { buildDevelopmentContract } from "./development.js";
import { FRAMEWORKS } from "./frameworks.js";
import { preflightPacket } from "./qc.js";
import { parseUniversalPacket } from "./schemas.js";
import { buildStoryboard } from "./storyboard.js";
import { PACKAGE_VERSION } from "./version.js";
import { compareRenderCycles, scoreRender } from "./evaluation.js";
import { compileContinuationPrompt } from "./continuation.js";

export interface CliIo {
  stdout: (value: string) => void;
  stderr: (value: string) => void;
}

const defaultIo: CliIo = {
  stdout: (value) => process.stdout.write(value),
  stderr: (value) => process.stderr.write(value),
};

const help = `AUTEUR Frameworks ${PACKAGE_VERSION}

Turn structured production intent into storyboards, provider-neutral prompt
packages, pre-flight reports, and constrained repair instructions.

Usage:
  auteur-frameworks <command> [input.json] [--out result.json]

Commands:
  frameworks              List the ten production frameworks
  develop <request.json>  Build an LLM-ready development contract
  validate <packet.json>  Validate a Universal Packet
  preflight <packet.json> Run continuity, timing, audio, and realism checks
  storyboard <packet.json> Project ordered storyboard panels
  compile <packet.json>   Compile video, frame, audio, and negative prompts
  continue <input.json>   Compile a render-observed extension prompt
  score-render <observation.json>  Score an observed provider result
  compare-renders <before.json> <after.json>  Measure cycle improvement
  help                    Show this guide
  version                 Print the package version

Examples:
  auteur-frameworks develop examples/requests/short-film.json
  auteur-frameworks preflight examples/short-film.json
  auteur-frameworks compile examples/product-film.json --out prompt-package.json
`;

function writeJson(value: unknown, outputPath: string | undefined, io: CliIo): void {
  const serialized = JSON.stringify(value, null, 2) + "\n";
  if (outputPath) fs.writeFileSync(outputPath, serialized, "utf8");
  else io.stdout(serialized);
}

function readJson(inputPath: string): unknown {
  return JSON.parse(fs.readFileSync(inputPath, "utf8"));
}

function errorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues
      .map((issue) => `${issue.path.join(".") || "packet"}: ${issue.message}`)
      .join("; ");
  }
  return error instanceof Error ? error.message : String(error);
}

export function runCli(args: string[], io: CliIo = defaultIo): number {
  const [rawCommand, ...rest] = args;
  const command = rawCommand?.toLowerCase();

  if (!command || command === "help" || command === "--help" || command === "-h") {
    io.stdout(help);
    return 0;
  }
  if (command === "version" || command === "--version" || command === "-v") {
    io.stdout(PACKAGE_VERSION + "\n");
    return 0;
  }

  const outIndex = rest.indexOf("--out");
  const outputPath = outIndex >= 0 ? rest[outIndex + 1] : undefined;
  const inputPath = rest.find((value, index) => (
    value !== "--out" && !(outIndex >= 0 && index === outIndex + 1)
  ));

  try {
    if (command === "frameworks") {
      writeJson(FRAMEWORKS, outputPath, io);
      return 0;
    }

    const inputCommands = new Set([
      "compare-renders",
      "compile",
      "continue",
      "develop",
      "preflight",
      "score-render",
      "storyboard",
      "validate",
    ]);
    if (!inputCommands.has(command)) {
      io.stderr(`AUTEUR_ERROR: Unknown command "${rawCommand}".\nACTION: Run auteur-frameworks help.\n`);
      return 2;
    }
    if (!inputPath) {
      io.stderr(`AUTEUR_ERROR: ${command} requires an input JSON file.\nACTION: Run auteur-frameworks help for an example.\n`);
      return 2;
    }
    if (outIndex >= 0 && !outputPath) {
      io.stderr("AUTEUR_ERROR: --out requires a file path.\nACTION: Add a destination such as --out result.json.\n");
      return 2;
    }

    const input = readJson(inputPath);
    let output: unknown;
    if (command === "compare-renders") {
      const inputPaths = rest.filter((value, index) => (
        value !== "--out" && !(outIndex >= 0 && index === outIndex + 1)
      ));
      if (inputPaths.length < 2) {
        io.stderr("AUTEUR_ERROR: compare-renders requires before and after observation files.\nACTION: Pass two render-observation JSON paths.\n");
        return 2;
      }
      output = compareRenderCycles(input, readJson(inputPaths[1]!));
    }
    else if (command === "compile") output = compilePacket(input);
    else if (command === "continue") output = compileContinuationPrompt(input);
    else if (command === "develop") output = buildDevelopmentContract(input);
    else if (command === "preflight") output = preflightPacket(parseUniversalPacket(input));
    else if (command === "score-render") output = scoreRender(input);
    else if (command === "storyboard") output = buildStoryboard(input);
    else output = parseUniversalPacket(input);
    writeJson(output, outputPath, io);
    return 0;
  } catch (error) {
    io.stderr(`AUTEUR_ERROR: ${errorMessage(error)}\nACTION: Correct the input and rerun ${command}.\n`);
    return 1;
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) process.exitCode = runCli(process.argv.slice(2));
