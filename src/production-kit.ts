import { compilePacket, type CompiledPackage, type CompiledShot } from "./compiler.js";
import { FRAMEWORKS } from "./frameworks.js";
import { preflightPacket } from "./qc.js";
import { FAILURE_REPAIRS, type FailureCode } from "./repair.js";
import { assessShotRoute, type ShotRouteAdvice } from "./route-advisor.js";
import { buildDelayedRevealSplitPlan, type DelayedRevealSplitPlan } from "./reveal-plan.js";
import { parseUniversalPacket, type UniversalPacket } from "./schemas.js";
import { buildStoryboard, type StoryboardPanel } from "./storyboard.js";

export interface ProductionAssetRequirement {
  id: string;
  type: "character" | "location" | "shot-reference" | "audio";
  label: string;
  required: boolean;
  shotIds: string[];
  purpose: string;
}

export interface ProductionShotPackage {
  shotId: string;
  sceneId: string;
  title: string;
  durationSeconds: number;
  action: string;
  beats: UniversalPacket["shots"][number]["beats"];
  camera: UniversalPacket["shots"][number]["camera"];
  lighting: UniversalPacket["shots"][number]["lighting"];
  continuityLocks: string[];
  route: ShotRouteAdvice;
  prompts: CompiledShot;
  revealSplitPlan: DelayedRevealSplitPlan | null;
}

export interface ProductionKit {
  kitVersion: "1.0.0";
  title: string;
  creativeBrief: UniversalPacket["metadata"];
  story: UniversalPacket["story"];
  scenePlan: UniversalPacket["scenes"];
  characterBible: UniversalPacket["characters"];
  worldBible: Array<{
    sceneId: string;
    location: string;
    timeOfDay: string;
    lightingSources: string[];
    palette: string[];
    materials: string[];
  }>;
  styleBible: {
    globalStyle: string[];
    palettes: string[];
    materials: string[];
    imperfectionAnchors: string[];
    globalExclusions: string[];
  };
  storyboard: StoryboardPanel[];
  shotList: ProductionShotPackage[];
  soundPlan: Array<{
    shotId: string;
    spokenText: string | null;
    soundDesign: string[];
    music: string | null;
  }>;
  continuityMatrix: Array<{
    shotId: string;
    sceneId: string;
    locks: string[];
    characterIds: string[];
    characterRelationshipStatus: "RESOLVED" | "NOT_APPLICABLE" | "UNKNOWN";
    characterLocks: string[];
  }>;
  assetManifest: ProductionAssetRequirement[];
  promptPackage: CompiledPackage;
  preflight: ReturnType<typeof preflightPacket>;
  repairCatalog: Array<{ code: FailureCode; instruction: string }>;
  exportManifest: {
    orderedShotIds: string[];
    deliverables: string[];
    dispatchRule: string;
    acceptanceRule: string;
  };
}

const unique = (values: string[]): string[] => [...new Set(values)];
const uniqueById = <T extends { id: string }>(values: T[]): T[] => values.filter(
  (value, index) => values.findIndex((candidate) => candidate.id === value.id) === index,
);

function buildAssetManifest(packet: UniversalPacket, routes: ShotRouteAdvice[]): ProductionAssetRequirement[] {
  const assets: ProductionAssetRequirement[] = [];
  for (const character of uniqueById(packet.characters)) {
    const shotIds = packet.shots
      .filter((shot) => shot.characterIds.includes(character.id))
      .map((shot) => shot.id);
    assets.push({
      id: "character-" + character.id,
      type: "character",
      label: character.name + " identity and wardrobe reference",
      required: packet.metadata.continuityStrictness === "strict",
      shotIds,
      purpose: [...character.identityLock, ...character.wardrobeLock].join("; "),
    });
  }
  for (const scene of uniqueById(packet.scenes)) {
    assets.push({
      id: "location-" + scene.id,
      type: "location",
      label: scene.location + " at " + scene.timeOfDay,
      required: packet.metadata.continuityStrictness === "strict" && scene.shotIds.length > 1,
      shotIds: scene.shotIds,
      purpose: "Lock location geometry, time of day, and screen direction across the scene.",
    });
  }
  for (const route of routes) {
    for (const [index, label] of route.requiredAssets.entries()) {
      const type = label.includes("dialogue") ? "audio" : "shot-reference";
      assets.push({
        id: `shot-${route.shotId}-reference-${index + 1}`,
        type,
        label,
        required: type === "audio" || route.recommendedMode !== "text-only",
        shotIds: [route.shotId],
        purpose: route.risks.map((risk) => risk.mitigation).join("; "),
      });
    }
  }
  return assets;
}

export function buildProductionKit(input: unknown): ProductionKit {
  const packet = parseUniversalPacket(input);
  const promptPackage = compilePacket(packet);
  const storyboard = buildStoryboard(packet);
  const routes = packet.shots.map((shot) => assessShotRoute(shot));
  const compiledByShot = new Map(promptPackage.shots.map((shot) => [shot.shotId, shot]));
  const routeByShot = new Map(routes.map((route) => [route.shotId, route]));

  return {
    kitVersion: "1.0.0",
    title: packet.metadata.title,
    creativeBrief: packet.metadata,
    story: packet.story,
    scenePlan: packet.scenes,
    characterBible: packet.characters,
    worldBible: packet.scenes.map((scene) => {
      const shots = packet.shots.filter((shot) => shot.sceneId === scene.id);
      return {
        sceneId: scene.id,
        location: scene.location,
        timeOfDay: scene.timeOfDay,
        lightingSources: unique(shots.map((shot) => shot.lighting.primarySource)),
        palette: unique(shots.flatMap((shot) => shot.lighting.paletteBase)),
        materials: unique(shots.flatMap((shot) => shot.materials)),
      };
    }),
    styleBible: {
      globalStyle: packet.globalStyle,
      palettes: unique(packet.shots.flatMap((shot) => shot.lighting.paletteBase)),
      materials: unique(packet.shots.flatMap((shot) => shot.materials)),
      imperfectionAnchors: unique(packet.shots.flatMap((shot) => shot.imperfectionAnchors)),
      globalExclusions: packet.globalExclusions,
    },
    storyboard,
    shotList: packet.shots.map((shot) => ({
      shotId: shot.id,
      sceneId: shot.sceneId,
      title: shot.title,
      durationSeconds: shot.durationSeconds,
      action: shot.action,
      beats: shot.beats,
      camera: shot.camera,
      lighting: shot.lighting,
      continuityLocks: shot.continuityLocks,
      route: routeByShot.get(shot.id)!,
      prompts: compiledByShot.get(shot.id)!,
      revealSplitPlan: routeByShot.get(shot.id)!.risks.some((risk) => risk.code === "DELAYED_TERMINAL_REVEAL")
        && shot.frameStates.opening && shot.frameStates.terminal
        ? buildDelayedRevealSplitPlan(shot, packet.globalExclusions, packet.globalStyle, {
          aspectRatio: packet.metadata.aspectRatio,
          audience: packet.metadata.audience,
          contentFormat: packet.metadata.format,
          dramaticQuestion: packet.story.dramaticQuestion,
          productionTitle: packet.metadata.title,
        })
        : null,
    })),
    soundPlan: packet.shots.map((shot) => ({
      shotId: shot.id,
      spokenText: shot.dialogue ?? shot.audioTrack.spokenText ?? null,
      soundDesign: shot.audioTrack.soundDesignDirectives,
      music: shot.audioTrack.musicDirective ?? null,
    })),
    continuityMatrix: packet.shots.map((shot) => {
      const characters = packet.characters.filter((character) => shot.characterIds.includes(character.id));
      const allCharacterIdsResolve = shot.characterIds.length > 0
        && characters.length === shot.characterIds.length;
      return {
        shotId: shot.id,
        sceneId: shot.sceneId,
        locks: shot.continuityLocks,
        characterIds: shot.characterIds,
        characterRelationshipStatus: packet.characters.length === 0
          ? "NOT_APPLICABLE"
          : allCharacterIdsResolve
            ? "RESOLVED"
            : "UNKNOWN",
        characterLocks: characters.flatMap((character) => [
          ...character.identityLock.map((lock) => character.name + ": " + lock),
          ...character.wardrobeLock.map((lock) => character.name + ": " + lock),
        ]),
      };
    }),
    assetManifest: buildAssetManifest(packet, routes),
    promptPackage,
    preflight: preflightPacket(packet),
    repairCatalog: Object.entries(FAILURE_REPAIRS).map(([code, instruction]) => ({
      code: code as FailureCode,
      instruction,
    })),
    exportManifest: {
      orderedShotIds: packet.shots.map((shot) => shot.id),
      deliverables: [
        "story and scene plan",
        "character and world bibles",
        "visual storyboard",
        "shot list and camera plan",
        "reference asset manifest",
        "video, frame, audio, and negative prompts",
        "continuity and preflight gates",
        "render scoring and constrained repair instructions",
      ],
      dispatchRule: "Dispatch only shots with a passing preflight, a non-overloaded constraint budget, and every required high-risk reference asset attached. A delayed reveal never dispatches from the primary single-pass prompt: use revealSplitPlan.preReveal first, then compile its render-observed continuation.",
      acceptanceRule: "Provider output is evidence, not success: inspect each route acceptance check before accepting or extending it.",
    },
  };
}
