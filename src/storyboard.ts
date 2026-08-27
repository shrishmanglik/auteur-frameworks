import { parseUniversalPacket } from "./schemas.js";
import { compileShot } from "./compiler.js";

export interface StoryboardPanel {
  index: number;
  shotId: string;
  sceneId: string;
  title: string;
  durationSeconds: number;
  openingFramePrompt: string;
  terminalFramePrompt: string;
  /** Back-compatible alias for openingFramePrompt. */
  framePrompt: string;
  action: string;
  camera: string;
  continuityLocks: string[];
  audioCue: string | null;
}

export function buildStoryboard(input: unknown): StoryboardPanel[] {
  const packet = parseUniversalPacket(input);
  return packet.shots.map((shot, index) => {
    const scene = packet.scenes.find((candidate) => candidate.id === shot.sceneId);
    // Must match compilePacket's call shape exactly. A storyboard panel and the prompt
    // package are two projections of one packet, so a frame prompt that differs between
    // them is a defect, not a variant: the omitted globalStyle silently dropped the
    // "Style: ..." clause from every panel while the prompt package kept it.
    const compiled = compileShot(shot, packet.globalExclusions, packet.globalStyle, {
      aspectRatio: packet.metadata.aspectRatio,
      audience: packet.metadata.audience,
      contentFormat: packet.metadata.format,
      dramaticQuestion: packet.story.dramaticQuestion,
      productionTitle: packet.metadata.title,
      providerTarget: packet.metadata.providerTarget,
      ...(scene ? { scenePurpose: scene.purpose, sceneTitle: scene.title } : {}),
      shotCount: packet.shots.length,
      shotIndex: index,
      storyLogline: packet.story.logline,
    });
    const audioCue = shot.audioTrack.soundDesignDirectives[0]
      ?? shot.audioTrack.musicDirective
      ?? shot.dialogue
      ?? null;
    return {
      index: index + 1,
      shotId: shot.id,
      sceneId: shot.sceneId,
      title: shot.title,
      durationSeconds: shot.durationSeconds,
      openingFramePrompt: compiled.openingFramePrompt,
      terminalFramePrompt: compiled.terminalFramePrompt,
      framePrompt: compiled.framePrompt,
      action: shot.action,
      camera: shot.camera.shotType + "; " + shot.camera.movement,
      continuityLocks: shot.continuityLocks,
      audioCue,
    };
  });
}
