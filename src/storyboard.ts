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
    const compiled = compileShot(shot);
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
