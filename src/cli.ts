#!/usr/bin/env node
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { ZodError } from "zod";
import { compilePacket } from "./compiler.js";
import { buildDevelopmentContract } from "./development.js";
import { draftPacket } from "./draft.js";
import { FRAMEWORKS } from "./frameworks.js";
import { preflightPacket } from "./qc.js";
import { parseUniversalPacket } from "./schemas.js";
import { buildStoryboard } from "./storyboard.js";
import { PACKAGE_VERSION } from "./version.js";
import { compareRenderCycles, scoreRender } from "./evaluation.js";
import { compileContinuationPrompt } from "./continuation.js";
import { buildProductionKit } from "./production-kit.js";
import { runMcpServer } from "./mcp.js";
import { planSpokenClip } from "./spoken-clip.js";
import { auditPostProductionPlan } from "./post-production.js";

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
  frameworks              List the eleven production frameworks
  develop <request.json>  Build an LLM-ready development contract
  draft <request.json>    Draft a complete Universal Packet deterministically, no LLM
                          [--seed N] [--concept 0|1|2]
  validate <packet.json>  Validate a Universal Packet
  preflight <packet.json> Run continuity, timing, audio, and realism checks
  storyboard <packet.json> Project ordered storyboard panels
  compile <packet.json>   Compile video, frame, audio, and negative prompts
  kit <packet.json>       Build the complete production kit in one artifact
  continue <input.json>   Compile a render-observed extension prompt
  score-render <observation.json>  Score an observed provider result
  compare-renders <before.json> <after.json>  Measure cycle improvement
  plan-spoken <input.json>  Select the smallest caller-supported spoken-clip duration
  audit-edit <plan.json>    Audit a deterministic post-production plan and review gates
  mcp                     Start the MCP stdio server for agent runtimes
  help                    Show this guide
  version                 Print the package version

Examples:
  auteur-frameworks draft examples/requests/short-film.json --out production.json
  auteur-frameworks develop examples/requests/short-film.json
  auteur-frameworks preflight examples/short-film.json
  auteur-frameworks kit examples/product-film.json --out production-kit.json
`;

function writeJson(value: unknown, outputPath: string | undefined, io: CliIo): void {
  const serialized = JSON.stringify(value, null, 2) + "\n";
  if (outputPath) {
    fs.writeFileSync(outputPath, serialized, "utf8");
    // Confirmation goes to stderr so piped stdout stays machine-clean.
    io.stderr(`AUTEUR_OK: wrote ${outputPath} (${Buffer.byteLength(serialized, "utf8")} bytes).\n`);
  }
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

  // Every value flag is registered here so the positional input path is whatever is left
  // over. Adding a flag without registering it would silently make its value look like the
  // input file.
  const VALUE_FLAGS = ["--out", "--seed", "--concept"] as const;
  const flagIndex = (flag: string): number => rest.indexOf(flag);
  const flagValue = (flag: string): string | undefined => {
    const index = flagIndex(flag);
    return index >= 0 ? rest[index + 1] : undefined;
  };
  const consumed = new Set<number>();
  for (const flag of VALUE_FLAGS) {
    const index = flagIndex(flag);
    if (index >= 0) { consumed.add(index); consumed.add(index + 1); }
  }
  const outIndex = flagIndex("--out");
  const outputPath = flagValue("--out");
  const inputPath = rest.find((_value, index) => !consumed.has(index));

  const readIntFlag = (flag: string): number | undefined => {
    const raw = flagValue(flag);
    if (raw === undefined) return undefined;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error(`${flag} requires a non-negative integer, received "${raw}".`);
    }
    return parsed;
  };

  try {
    if (command === "frameworks") {
      writeJson(FRAMEWORKS, outputPath, io);
      return 0;
    }

    if (command === "mcp") {
      // Long-running stdio loop; it owns the process until stdin closes.
      runMcpServer(process.stdin, io);
      return 0;
    }

    const inputCommands = new Set([
      "compare-renders",
      "compile",
      "continue",
      "develop",
      "draft",
      "kit",
      "preflight",
      "score-render",
      "plan-spoken",
      "audit-edit",
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
      // Use the same consumed-index set as the single-input commands. This used to filter
      // only --out, so any other value flag left its value in the list and the second
      // "input path" became the flag's argument - the exact failure the registry exists to
      // prevent, reproduced inside the one command that opted out of it.
      const inputPaths = rest.filter((_value, index) => !consumed.has(index));
      if (inputPaths.length < 2) {
        io.stderr("AUTEUR_ERROR: compare-renders requires before and after observation files.\nACTION: Pass two render-observation JSON paths.\n");
        return 2;
      }
      output = compareRenderCycles(input, readJson(inputPaths[1]!));
    }
    else if (command === "compile") output = compilePacket(input);
    else if (command === "continue") output = compileContinuationPrompt(input);
    else if (command === "develop") output = buildDevelopmentContract(input);
    else if (command === "draft") {
      output = draftPacket(input, {
        ...(readIntFlag("--seed") === undefined ? {} : { seed: readIntFlag("--seed")! }),
        ...(readIntFlag("--concept") === undefined ? {} : { conceptIndex: readIntFlag("--concept")! }),
      }).packet;
    }
    else if (command === "kit") output = buildProductionKit(input);
    else if (command === "preflight") output = preflightPacket(parseUniversalPacket(input));
    else if (command === "score-render") output = scoreRender(input);
    else if (command === "plan-spoken") output = planSpokenClip(input);
    else if (command === "audit-edit") output = auditPostProductionPlan(input);
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
