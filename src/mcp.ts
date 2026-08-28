// Dependency-free MCP stdio server.
//
// Agent runtimes (Claude Code, Codex, Cursor, custom orchestrators) can call the
// AUTEUR projections directly instead of shelling out to the CLI and managing
// temporary files. Every tool wraps the same pure function the CLI uses, so the
// MCP surface cannot drift from the command surface.
//
// This server never calls an LLM or a generation provider. It builds and validates
// contracts; the host application owns credentials, spend, and routing.
import { ZodError } from "zod";
import { compilePacket } from "./compiler.js";
import { compileContinuationPrompt } from "./continuation.js";
import { buildDevelopmentContract } from "./development.js";
import { draftPacket } from "./draft.js";
import { compareRenderCycles, scoreRender } from "./evaluation.js";
import { FRAMEWORKS } from "./frameworks.js";
import { buildProductionKit } from "./production-kit.js";
import { preflightPacket } from "./qc.js";
import { parseUniversalPacket } from "./schemas.js";
import { buildStoryboard } from "./storyboard.js";
import { PACKAGE_VERSION } from "./version.js";
import { planSpokenClip } from "./spoken-clip.js";
import { auditPostProductionPlan } from "./post-production.js";

export const MCP_PROTOCOL_VERSION = "2024-11-05";
export const MCP_SERVER_NAME = "auteur-frameworks";

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: Record<string, unknown>) => unknown;
}

const packetArg = {
  type: "object",
  properties: {
    packet: { type: "object", description: "A Universal Packet object." },
  },
  required: ["packet"],
} as const;

function requireObject(args: Record<string, unknown>, key: string): unknown {
  const value = args?.[key];
  if (value === undefined || value === null) {
    throw new Error(`${key} is required.`);
  }
  return value;
}

export const TOOLS: ToolDefinition[] = [
  {
    name: "auteur_frameworks",
    description:
      "List the production framework registry with purpose, best-for formats, and required blocks. Use this to choose a framework before compiling.",
    inputSchema: { type: "object", properties: {} },
    run: () => FRAMEWORKS,
  },
  {
    name: "auteur_develop",
    description:
      "Turn a development request into a schema-bound contract (systemInstruction, userBrief, responseSchema) for a structured-output LLM. The caller sends these to their own model.",
    inputSchema: {
      type: "object",
      properties: { request: { type: "object", description: "A development request object." } },
      required: ["request"],
    },
    run: (args) => buildDevelopmentContract(requireObject(args, "request")),
  },
  {
    name: "auteur_draft",
    description:
      "Draft a complete, validated Universal Packet directly from a development request, deterministically and without calling any model. Same request and seed always produce the same packet. Use it to reach a runnable packet with no provider in the loop, then refine it or hand it to auteur_kit.",
    inputSchema: {
      type: "object",
      properties: {
        request: { type: "object", description: "A development request object." },
        seed: { type: "number", description: "Changes concept selection and every downstream choice. Defaults to 0." },
        conceptIndex: { type: "number", description: "Which of the three concepts to build: 0, 1, or 2. Defaults to 0." },
      },
      required: ["request"],
    },
    run: (args) => {
      const options: { seed?: number; conceptIndex?: number } = {};
      if (typeof args?.seed === "number") options.seed = args.seed;
      if (typeof args?.conceptIndex === "number") options.conceptIndex = args.conceptIndex;
      return draftPacket(requireObject(args, "request"), options);
    },
  },
  {
    name: "auteur_validate",
    description:
      "Validate a Universal Packet and return the parsed packet. Treat model output as untrusted until this passes.",
    inputSchema: packetArg,
    run: (args) => parseUniversalPacket(requireObject(args, "packet")),
  },
  {
    name: "auteur_preflight",
    description:
      "Run continuity, timing, audio, and realism checks over a Universal Packet. Resolve issues before spending on generation.",
    inputSchema: packetArg,
    run: (args) => preflightPacket(parseUniversalPacket(requireObject(args, "packet"))),
  },
  {
    name: "auteur_storyboard",
    description: "Project ordered storyboard panels from a Universal Packet.",
    inputSchema: packetArg,
    run: (args) => buildStoryboard(requireObject(args, "packet")),
  },
  {
    name: "auteur_compile",
    description: "Compile video, frame, audio, and negative prompts from a Universal Packet.",
    inputSchema: packetArg,
    run: (args) => compilePacket(requireObject(args, "packet")),
  },
  {
    name: "auteur_kit",
    description:
      "Build the complete production kit in one artifact: brief, story, scenes, bibles, storyboard, shot list, sound plan, continuity matrix, assets, prompts, pre-flight, repairs, and export manifest.",
    inputSchema: packetArg,
    run: (args) => buildProductionKit(requireObject(args, "packet")),
  },
  {
    name: "auteur_continue",
    description:
      "Compile a render-observed extension prompt grounded in the actual previous final frame. Only use after inspecting a real rendered frame.",
    inputSchema: {
      type: "object",
      properties: { input: { type: "object", description: "A continuation input object." } },
      required: ["input"],
    },
    run: (args) => compileContinuationPrompt(requireObject(args, "input")),
  },
  {
    name: "auteur_score_render",
    description: "Score an observed provider result against the intent it was generated from.",
    inputSchema: {
      type: "object",
      properties: { observation: { type: "object", description: "A render-observation object." } },
      required: ["observation"],
    },
    run: (args) => scoreRender(requireObject(args, "observation")),
  },
  {
    name: "auteur_plan_spoken",
    description:
      "Count audible words, select the smallest caller-declared supported duration, and compile a script-once A-roll prompt with one performance cue.",
    inputSchema: {
      type: "object",
      properties: { input: { type: "object", description: "A spoken-clip planning input object." } },
      required: ["input"],
    },
    run: (args) => planSpokenClip(requireObject(args, "input")),
  },
  {
    name: "auteur_audit_edit",
    description:
      "Audit source identity, phrase-safe trims, overlays, B-roll purpose, picture, audio, upscale labeling, QC, and separate human review gates.",
    inputSchema: {
      type: "object",
      properties: { plan: { type: "object", description: "An AUTEUR post-production plan object." } },
      required: ["plan"],
    },
    run: (args) => auditPostProductionPlan(requireObject(args, "plan")),
  },
  {
    name: "auteur_compare_renders",
    description: "Measure improvement between two render observations (before and after a repair cycle).",
    inputSchema: {
      type: "object",
      properties: {
        before: { type: "object", description: "Earlier render observation." },
        after: { type: "object", description: "Later render observation." },
      },
      required: ["before", "after"],
    },
    run: (args) => compareRenderCycles(requireObject(args, "before"), requireObject(args, "after")),
  },
];

function toolErrorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues
      .map((issue) => `${issue.path.join(".") || "packet"}: ${issue.message}`)
      .join("; ");
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Handle one JSON-RPC message. Returns the response object, or null for
 * notifications (messages without an id), which must not be answered.
 */
export function handleMcpMessage(request: JsonRpcRequest): Record<string, unknown> | null {
  const { id, method, params } = request;
  if (id === undefined || id === null) return null;

  const reply = (result: unknown) => ({ jsonrpc: "2.0", id, result });

  if (method === "initialize") {
    return reply({
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: MCP_SERVER_NAME, version: PACKAGE_VERSION },
    });
  }

  if (method === "tools/list") {
    return reply({
      tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
    });
  }

  if (method === "tools/call") {
    const name = (params?.["name"] as string) ?? "";
    const args = (params?.["arguments"] as Record<string, unknown>) ?? {};
    const tool = TOOLS.find((candidate) => candidate.name === name);

    // Tool-level failures are reported as isError results, not transport errors,
    // so the calling agent can read and act on the message.
    if (!tool) {
      return reply({
        content: [{ type: "text", text: `Error: Unknown tool: ${name}` }],
        isError: true,
      });
    }

    try {
      const output = tool.run(args);
      return reply({ content: [{ type: "text", text: JSON.stringify(output, null, 2) }] });
    } catch (error) {
      return reply({
        content: [{ type: "text", text: `Error: ${toolErrorMessage(error)}` }],
        isError: true,
      });
    }
  }

  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
}

export interface McpIo {
  stdout: (value: string) => void;
  stderr: (value: string) => void;
}

/** Run the newline-delimited JSON-RPC stdio loop until stdin closes. */
export function runMcpServer(
  input: NodeJS.ReadableStream = process.stdin,
  io: McpIo = {
    stdout: (value) => process.stdout.write(value),
    stderr: (value) => process.stderr.write(value),
  }
): void {
  let buffer = "";
  input.setEncoding?.("utf8");
  io.stderr(`auteur-frameworks mcp server ready (stdio, protocol ${MCP_PROTOCOL_VERSION})\n`);

  input.on("data", (chunk: string) => {
    buffer += chunk;
    let index = buffer.indexOf("\n");
    while (index >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (line) {
        let response: Record<string, unknown> | null = null;
        try {
          response = handleMcpMessage(JSON.parse(line) as JsonRpcRequest);
        } catch {
          response = { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } };
        }
        if (response) io.stdout(`${JSON.stringify(response)}\n`);
      }
      index = buffer.indexOf("\n");
    }
  });
}
