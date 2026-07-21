import { z } from "zod";

export const ContentFormatSchema = z.enum([
  "short-film",
  "ad",
  "reel",
  "a-roll",
  "b-roll",
  "music-video",
  "product-film",
  "character-scene",
  "vfx",
  "animation",
  "image",
  "sequence",
  "other",
]);

export const AspectRatioSchema = z.enum(["16:9", "9:16", "1:1", "4:5", "2.39:1", "custom"]);
export const ContinuityStrictnessSchema = z.enum(["relaxed", "standard", "strict"]);

export const DevelopmentRequestSchema = z.object({
  idea: z.string().min(10),
  format: ContentFormatSchema,
  targetDurationSeconds: z.number().positive(),
  aspectRatio: AspectRatioSchema,
  audience: z.string().min(1),
  tone: z.array(z.string().min(1)).min(1),
  constraints: z.array(z.string().min(1)).default([]),
  creativeMandate: z.string().min(1).optional(),
  mustInclude: z.array(z.string().min(1)).default([]),
  avoidCliches: z.array(z.string().min(1)).default([]),
  hasDialogue: z.boolean().default(false),
  requiresTransformation: z.boolean().default(false),
  audioRequired: z.boolean().default(false),
});

export const BeatSchema = z.object({
  startSeconds: z.number().min(0),
  endSeconds: z.number().positive(),
  action: z.string().min(1),
}).superRefine((beat, ctx) => {
  if (beat.endSeconds <= beat.startSeconds) {
    ctx.addIssue({ code: "custom", message: "endSeconds must be greater than startSeconds" });
  }
});

export const OpticsSchema = z.object({
  cameraBody: z.string().min(1).optional(),
  lensModel: z.string().min(1).optional(),
  focalLengthMm: z.number().min(8).max(1200),
  tStop: z.number().min(0.7).max(32),
  subjectDistanceMeters: z.number().positive().max(10000),
});

export const CameraSchema = z.object({
  shotType: z.string().min(1),
  movement: z.string().min(1),
  framing: z.string().min(1),
  focusBehavior: z.string().min(1),
  optics: OpticsSchema,
});

export const LightingSchema = z.object({
  primarySource: z.string().min(1),
  motivation: z.string().min(1),
  paletteBase: z.array(z.string().min(1)).min(1),
  isDesaturated: z.boolean().default(false),
  isCrushedBlacks: z.boolean().default(false),
});

export const AudioTrackSchema = z.object({
  spokenText: z.string().min(1).optional(),
  soundDesignDirectives: z.array(z.string().min(1)).default([]),
  musicDirective: z.string().min(1).optional(),
});

export const CharacterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  identityLock: z.array(z.string().min(1)).min(1),
  wardrobeLock: z.array(z.string().min(1)).default([]),
});

export const StoryBeatSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  purpose: z.string().min(1),
  emotionalTurn: z.string().min(1),
});

export const ShotSchema = z.object({
  id: z.string().min(1),
  sceneId: z.string().min(1),
  title: z.string().min(1),
  durationSeconds: z.number().positive().max(300),
  intent: z.string().min(1),
  subject: z.string().min(1),
  action: z.string().min(1),
  environment: z.string().min(1),
  camera: CameraSchema,
  lighting: LightingSchema,
  physics: z.array(z.string().min(1)).min(1),
  materials: z.array(z.string().min(1)).default([]),
  beats: z.array(BeatSchema).min(1),
  continuityLocks: z.array(z.string().min(1)).min(1),
  imperfectionAnchors: z.array(z.string().min(1)).default([]),
  audioTrack: AudioTrackSchema.default({
    soundDesignDirectives: [],
  }),
  dialogue: z.string().min(1).optional(),
  onScreenText: z.string().min(1).optional(),
  exclusions: z.array(z.string().min(1)).default([]),
  frameworkId: z.string().min(1),
});

export const SceneSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  purpose: z.string().min(1),
  location: z.string().min(1),
  timeOfDay: z.string().min(1),
  shotIds: z.array(z.string().min(1)).min(1),
});

export const UniversalPacketSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  metadata: z.object({
    title: z.string().min(1),
    format: ContentFormatSchema,
    aspectRatio: AspectRatioSchema,
    targetDurationSeconds: z.number().positive(),
    audience: z.string().min(1),
    tone: z.array(z.string().min(1)).min(1),
    providerTarget: z.string().min(1).default("provider-neutral"),
    continuityStrictness: ContinuityStrictnessSchema.default("standard"),
    audioRequired: z.boolean().default(false),
  }),
  story: z.object({
    logline: z.string().min(1),
    dramaticQuestion: z.string().min(1),
    beats: z.array(StoryBeatSchema).min(1),
  }),
  characters: z.array(CharacterSchema).default([]),
  scenes: z.array(SceneSchema).min(1),
  shots: z.array(ShotSchema).min(1),
  globalStyle: z.array(z.string().min(1)).min(1),
  globalExclusions: z.array(z.string().min(1)).default([]),
});

export type ContentFormat = z.infer<typeof ContentFormatSchema>;
export type DevelopmentRequest = z.infer<typeof DevelopmentRequestSchema>;
export type Optics = z.infer<typeof OpticsSchema>;
export type Shot = z.infer<typeof ShotSchema>;
export type UniversalPacket = z.infer<typeof UniversalPacketSchema>;

export function parseUniversalPacket(input: unknown): UniversalPacket {
  return UniversalPacketSchema.parse(input);
}
