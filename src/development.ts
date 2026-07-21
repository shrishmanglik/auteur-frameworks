import { z } from "zod";
import {
  DevelopmentRequestSchema,
  UniversalPacketSchema,
  type DevelopmentRequest,
} from "./schemas.js";
import { getFramework, type FrameworkDefinition } from "./frameworks.js";

export interface DevelopmentContract {
  request: DevelopmentRequest;
  framework: FrameworkDefinition;
  systemInstruction: string;
  userBrief: string;
  responseSchema: Record<string, unknown>;
}

export function selectFramework(request: DevelopmentRequest): FrameworkDefinition {
  if (request.requiresTransformation || request.format === "vfx") return getFramework("temporal-evolution");
  if (request.format === "reel") return getFramework("timed-social-sequence");
  if (request.format === "short-film" || request.format === "music-video" || request.format === "sequence") {
    return getFramework("act-shot-master-spec");
  }
  if (request.format === "a-roll" || request.format === "character-scene") return getFramework("continuous-take");
  return getFramework("cinematic-prose-stack");
}

export function buildDevelopmentContract(input: unknown): DevelopmentContract {
  const request = DevelopmentRequestSchema.parse(input);
  const framework = selectFramework(request);
  const systemInstruction = [
    "You are developing an original production, not writing a loose prompt.",
    "Return only data that conforms to the supplied Universal Packet JSON Schema.",
    "Create a specific logline, dramatic question, causal beats, scenes, and generation-ready shots.",
    "Prefer one surprising but inevitable creative premise over disconnected spectacle or generic genre filler.",
    "Build humor, emotion, and originality through observable behavior, reversals, timing, and consequences.",
    "Each shot must have one dominant action, a complete temporal plan, physical behavior, optics, lighting motivation, continuity locks, realism anchors, audio intent, and exclusions.",
    "Use references as craft properties, never as instructions to imitate a living artist.",
    "Do not invent provider capabilities, duration limits, prices, or API behavior.",
    "Framework route: " + framework.name + ". Required blocks: " + framework.requiredBlocks.join(", ") + ".",
  ].join("\n");
  const userBrief = [
    "IDEA: " + request.idea,
    "FORMAT: " + request.format,
    "DURATION: " + request.targetDurationSeconds + " seconds",
    "ASPECT: " + request.aspectRatio,
    "AUDIENCE: " + request.audience,
    "TONE: " + request.tone.join(", "),
    request.creativeMandate ? "CREATIVE MANDATE: " + request.creativeMandate : "CREATIVE MANDATE: derive one specific, non-generic point of view",
    request.mustInclude.length ? "MUST INCLUDE: " + request.mustInclude.join("; ") : "MUST INCLUDE: none supplied",
    request.avoidCliches.length ? "AVOID CLICHES: " + request.avoidCliches.join("; ") : "AVOID CLICHES: generic montage; empty spectacle; unearned sentiment",
    "DIALOGUE: " + (request.hasDialogue ? "required where dramatically useful" : "not required"),
    "AUDIO: " + (request.audioRequired ? "explicit contract required" : "optional"),
    request.constraints.length ? "CONSTRAINTS: " + request.constraints.join("; ") : "CONSTRAINTS: none supplied",
  ].join("\n");

  return {
    request,
    framework,
    systemInstruction,
    userBrief,
    responseSchema: z.toJSONSchema(UniversalPacketSchema) as Record<string, unknown>,
  };
}
