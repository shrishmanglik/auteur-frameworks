import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { handleMcpMessage, MCP_PROTOCOL_VERSION, TOOLS } from "../src/mcp.js";
import { FRAMEWORKS } from "../src/frameworks.js";

const productFilm = JSON.parse(readFileSync("examples/product-film.json", "utf8"));
const spokenClip = JSON.parse(readFileSync("examples/spoken-clip-plan.json", "utf8"));
const postProduction = JSON.parse(readFileSync("examples/post-production-plan.json", "utf8"));

function call(name: string, args: Record<string, unknown> = {}) {
  return handleMcpMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name, arguments: args },
  }) as { result: { content: { text: string }[]; isError?: boolean } };
}

function payload(response: ReturnType<typeof call>): unknown {
  return JSON.parse(response.result.content[0]!.text);
}

describe("mcp handshake", () => {
  it("initializes with a protocol version and server info", () => {
    const response = handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    const result = (response as { result: Record<string, any> }).result;
    expect(result.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
    expect(result.serverInfo.name).toBe("auteur-frameworks");
  });

  it("lists every tool with a description and input schema", () => {
    const response = handleMcpMessage({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const tools = (response as { result: { tools: any[] } }).result.tools;
    expect(tools.length).toBe(TOOLS.length);
    for (const tool of tools) {
      expect(tool.name).toMatch(/^auteur_/);
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  it("ignores notifications, which must never be answered", () => {
    expect(handleMcpMessage({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
  });

  it("returns a JSON-RPC error for an unknown method", () => {
    const response = handleMcpMessage({ jsonrpc: "2.0", id: 3, method: "does/notExist" }) as {
      error: { code: number };
    };
    expect(response.error.code).toBe(-32601);
  });
});

describe("mcp tools mirror the CLI surface", () => {
  it("auteur_frameworks returns the whole registry", () => {
    expect(payload(call("auteur_frameworks"))).toHaveLength(FRAMEWORKS.length);
  });

  it("auteur_kit builds a production kit from a packet", () => {
    const kit = payload(call("auteur_kit", { packet: productFilm })) as Record<string, unknown>;
    expect(kit.promptPackage).toBeDefined();
    expect(kit.exportManifest).toBeDefined();
  });

  it("auteur_preflight runs checks over a packet", () => {
    const report = payload(call("auteur_preflight", { packet: productFilm })) as Record<string, unknown>;
    expect(report).toHaveProperty("passed");
  });

  it("auteur_plan_spoken and auteur_audit_edit mirror their CLI functions", () => {
    const spoken = payload(call("auteur_plan_spoken", { input: spokenClip })) as Record<string, unknown>;
    expect(spoken.selectedDurationSeconds).toBe(6);

    const edit = payload(call("auteur_audit_edit", { plan: postProduction })) as Record<string, unknown>;
    expect(edit.releaseDecision).toBe("ACCEPT");
  });
});

describe("mcp error handling", () => {
  it("reports an unknown tool as an isError result, not a transport error", () => {
    const response = call("auteur_not_a_tool");
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0]!.text).toMatch(/Unknown tool/);
  });

  it("reports invalid packets as readable validation errors", () => {
    const response = call("auteur_validate", { packet: { nonsense: true } });
    expect(response.result.isError).toBe(true);
    // The agent must be able to act on the message, so field paths are preserved.
    expect(response.result.content[0]!.text).toMatch(/schemaVersion/);
  });

  it("reports missing required arguments", () => {
    const response = call("auteur_kit", {});
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0]!.text).toMatch(/packet is required/);
  });
});
