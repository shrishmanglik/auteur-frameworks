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
  if (request.format === "a-roll") return getFramework("avatar-a-roll-json");
  if (request.audioFirst) return getFramework("audio-contract");
  if (request.requiresMachineReadableSceneContract) return getFramework("json-scene-contract");
  if (request.requiresTransformation || request.format === "vfx") return getFramework("temporal-evolution");
  if (request.requiresPracticalChoreography) return getFramework("practical-stunt-contract");
  if (request.format === "reel") return getFramework("timed-social-sequence");
  if (request.format === "short-film" || request.format === "music-video" || request.format === "sequence") {
    return getFramework("act-shot-master-spec");
  }
  if (request.format === "character-scene") return getFramework("continuous-take");
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
    "Assign explicit characterIds to every shot; use an empty list only when no cast member appears.",
    "Declare generationRisks when a shot depends on causal contact, mechanical assembly, multi-subject dynamics, precise spatial clearance, exact fluid counts, brand or text control, identity or performance, transformation phases, exact dialogue audio, or frame-accurate audio/action synchronization.",
    "Use references as craft properties, never as instructions to imitate a living artist.",
    "Do not invent provider capabilities, duration limits, prices, or API behavior.",
    "Primary framework route: " + framework.name + ". Required blocks: " + framework.requiredBlocks.join(", ") + ".",
    "Assign the primary frameworkId to ordinary shots. A-roll always uses avatar-a-roll-json so identity, facial performance, exact speech, optics, and acceptance tests remain one structured contract. Override other shots only when their production problem requires a more specific architecture: practical-stunt-contract for contact/mass/momentum choreography; temporal-evolution for visible state change; continuous-take for a non-A-roll unbroken action; timed-social-sequence for retention-led short form; audio-contract for audio-first work; json-scene-contract for a general machine-readable handoff.",
    "When exact dialogue is required, set audioTrack.spokenWindow to the intended beat boundaries. When brand or text control is required, describe the intended blank surface as a positive material/color state as well as excluding invented marks.",
    "For every multi-stage reference-first shot, populate frameStates.opening from opening-only structured data and frameStates.terminal from final-beat data. Never copy a later object, relationship, illumination, discovery, or continuity phrase into frameStates.opening.",
    "When frameStates.terminal introduces visible inventory absent from frameStates.opening, mark DELAYED_TERMINAL_REVEAL and split the generation. The pre-reveal pass must not name or attach terminal-only inventory; compile the reveal only after the accepted pre-reveal render's actual final frame has been observed.",
    "Do not combine delayed exact dialogue, three or more physical stages, strict blank-surface control, and identity-critical performance in one short shot. Split at a stable visual handoff so each generated shot has one dominant control problem.",
    "Never assign repair-pass without an observed defect, and never assign render-observed-continuation without the accepted render's actual final-frame evidence.",
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
    "PRACTICAL CHOREOGRAPHY: " + (request.requiresPracticalChoreography ? "required" : "not specifically required"),
    "MACHINE-READABLE SCENE CONTRACT: " + (request.requiresMachineReadableSceneContract ? "required" : "not specifically required"),
    "AUDIO-FIRST: " + (request.audioFirst ? "yes" : "no"),
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
