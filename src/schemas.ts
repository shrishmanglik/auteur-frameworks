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
export const GenerationRiskCodeSchema = z.enum([
  "CAUSAL_CONTACT_CHOREOGRAPHY",
  "PRECISE_MECHANICAL_ASSEMBLY",
  "MULTI_SUBJECT_DYNAMICS",
  "PRECISE_SPATIAL_CLEARANCE",
  "EXACT_FLUID_COUNT",
  "BRAND_OR_TEXT_CONTROL",
  "IDENTITY_OR_PERFORMANCE",
  "DELAYED_TERMINAL_REVEAL",
  "TRANSFORMATION_PHASES",
  "EXACT_DIALOGUE_AUDIO",
  "AUDIO_ACTION_SYNCHRONIZATION",
]);

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
  requiresPracticalChoreography: z.boolean().default(false),
  requiresMachineReadableSceneContract: z.boolean().default(false),
  audioFirst: z.boolean().default(false),
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

export const CaptureSchema = z.object({
  sensorFormat: z.string().min(1).optional(),
  recordingFormat: z.string().min(1).optional(),
  rig: z.string().min(1).optional(),
  frameRateFps: z.number().positive().max(1000).optional(),
  shutterAngleDegrees: z.number().positive().max(360).optional(),
  resolutionIntent: z.string().min(1).optional(),
}).default({});

export const CameraSchema = z.object({
  shotType: z.string().min(1),
  movement: z.string().min(1),
  framing: z.string().min(1),
  focusBehavior: z.string().min(1),
  optics: OpticsSchema,
  capture: CaptureSchema,
});

export const LightingSchema = z.object({
  primarySource: z.string().min(1),
  motivation: z.string().min(1),
  paletteBase: z.array(z.string().min(1)).min(1),
  isDesaturated: z.boolean().default(false),
  isCrushedBlacks: z.boolean().default(false),
});

export const ARollPerformanceModeSchema = z.enum([
  "restrained-stillness",
  "facial-only",
  "single-gesture",
  "posture-shift",
  "object-interaction",
]);

const GestureCueSchema = z.object({
  timeSeconds: z.number().min(0).max(300),
  keyword: z.string().min(1).optional(),
  hand: z.string().min(1).optional(),
  type: z.string().min(1),
  scale: z.string().min(1).optional(),
  durationSeconds: z.number().positive().max(4).optional(),
  purpose: z.string().min(1).optional(),
});

const MicroExpressionCueSchema = z.object({
  timeSeconds: z.number().min(0).max(300),
  keyword: z.string().min(1).optional(),
  action: z.string().min(1),
  intensity: z.enum(["barely-perceptible", "restrained", "visible"]).default("restrained"),
});

export const PerformanceSchema = z.object({
  mode: ARollPerformanceModeSchema.optional(),
  basePosture: z.string().min(1).optional(),
  eyeLine: z.string().min(1).optional(),
  deliveryStyle: z.string().min(1).optional(),
  lipArticulationStyle: z.string().min(1).optional(),
  headMovementMaxDegrees: z.number().min(0).max(45).optional(),
  jawMovementMaxDeviationMm: z.number().min(0).max(25).optional(),
  emotionalExpressionSource: z.string().min(1).optional(),
  facialBiomechanics: z.object({
    jawBehavior: z.string().min(1).optional(),
    lipBehavior: z.string().min(1).optional(),
    cheekBehavior: z.string().min(1).optional(),
    teethBehavior: z.string().min(1).optional(),
    blinkBehavior: z.string().min(1).optional(),
    skinBehavior: z.string().min(1).optional(),
    hairBehavior: z.string().min(1).optional(),
  }).optional(),
  freezePadFramesAtEnd: z.number().int().min(0).max(240).optional(),
  gestureBounds: z.object({
    handsEnabled: z.boolean().optional(),
    amplitudeDegreesMax: z.number().min(0).max(30).optional(),
    ratePer8SecondsMax: z.number().int().min(0).max(12).optional(),
    style: z.string().min(1).optional(),
  }).optional(),
  headMotion: z.object({
    yawDegreesMax: z.number().min(0).max(45).optional(),
    pitchDegreesMax: z.number().min(0).max(45).optional(),
    nodsMax: z.number().int().min(0).max(12).optional(),
  }).optional(),
  bodyMotion: z.object({
    postureShift: z.string().min(1).optional(),
    breathingPattern: z.string().min(1).optional(),
    breathsPerMinute: z.number().min(4).max(40).optional(),
  }).optional(),
  gestureCues: z.array(GestureCueSchema).optional(),
  microExpressionCues: z.array(MicroExpressionCueSchema).optional(),
}).default({});

export const AudioTrackSchema = z.object({
  spokenText: z.string().min(1).optional(),
  spokenWindow: z.object({
    startSeconds: z.number().min(0),
    endSeconds: z.number().positive(),
  }).superRefine((window, ctx) => {
    if (window.endSeconds <= window.startSeconds) {
      ctx.addIssue({ code: "custom", message: "spokenWindow.endSeconds must be greater than startSeconds" });
    }
  }).optional(),
  soundDesignDirectives: z.array(z.string().min(1)).default([]),
  musicDirective: z.string().min(1).optional(),
  voiceProfileId: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
  paceWpm: z.number().min(60).max(240).optional(),
  deliveryStyle: z.string().min(1).optional(),
  accent: z.string().min(1).optional(),
  basePitchHz: z.number().min(40).max(600).optional(),
  pitchRangeHz: z.object({
    min: z.number().min(40).max(600),
    max: z.number().min(40).max(600),
  }).optional(),
  speechRateTolerancePercent: z.number().min(1).max(25).optional(),
  vocalDynamicsDb: z.number().min(1).max(30).optional(),
  breathPattern: z.string().min(1).optional(),
  personaTone: z.string().min(1).optional(),
  cadenceStyle: z.string().min(1).optional(),
  articulation: z.string().min(1).optional(),
  intonationNotes: z.string().min(1).optional(),
  timbre: z.string().min(1).optional(),
  micStyle: z.string().min(1).optional(),
  roomTone: z.string().min(1).optional(),
  emphasisCues: z.array(z.object({
    word: z.string().min(1),
    pitchBoostPercent: z.number().min(0).max(25).optional(),
    stress: z.string().min(1).optional(),
  })).optional(),
  phonemeToleranceMs: z.number().min(0).max(250).optional(),
  lipSyncConfidenceMin: z.number().min(0).max(1).optional(),
  mix: z.object({
    integratedLufs: z.number().min(-70).max(0).optional(),
    truePeakDbfsMax: z.number().min(-20).max(0).optional(),
    stereoWidth: z.string().min(1).optional(),
  }).optional(),
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

export const ReferenceFrameStateSchema = z.object({
  subject: z.string().min(1),
  action: z.string().min(1),
  environment: z.string().min(1),
  visibleInventory: z.array(z.string().min(1)).default([]),
  lighting: z.string().min(1).optional(),
  paletteBase: z.array(z.string().min(1)).default([]),
  materials: z.array(z.string().min(1)).default([]),
  imperfectionAnchors: z.array(z.string().min(1)).default([]),
  continuityLocks: z.array(z.string().min(1)).default([]),
});

export const ShotSchema = z.object({
  id: z.string().min(1),
  sceneId: z.string().min(1),
  title: z.string().min(1),
  characterIds: z.array(z.string().min(1)).default([]),
  generationRisks: z.array(GenerationRiskCodeSchema).default([]),
  durationSeconds: z.number().positive().max(300),
  intent: z.string().min(1),
  subject: z.string().min(1),
  action: z.string().min(1),
  environment: z.string().min(1),
  frameStates: z.object({
    opening: ReferenceFrameStateSchema.optional(),
    terminal: ReferenceFrameStateSchema.optional(),
  }).default({}),
  camera: CameraSchema,
  lighting: LightingSchema,
  physics: z.array(z.string().min(1)).min(1),
  materials: z.array(z.string().min(1)).default([]),
  beats: z.array(BeatSchema).min(1),
  continuityLocks: z.array(z.string().min(1)).min(1),
  imperfectionAnchors: z.array(z.string().min(1)).default([]),
  performance: PerformanceSchema,
  audioTrack: AudioTrackSchema.default({
    soundDesignDirectives: [],
  }),
  dialogue: z.string().min(1).optional(),
  onScreenText: z.string().min(1).optional(),
  exclusions: z.array(z.string().min(1)).default([]),
  frameworkId: z.string().min(1),
}).superRefine((shot, ctx) => {
  shot.performance.gestureCues?.forEach((cue, index) => {
    if (cue.timeSeconds >= shot.durationSeconds) {
      ctx.addIssue({
        code: "custom",
        path: ["performance", "gestureCues", index, "timeSeconds"],
        message: "gesture cue must occur before the shot ends",
      });
    }
  });
  shot.performance.microExpressionCues?.forEach((cue, index) => {
    if (cue.timeSeconds >= shot.durationSeconds) {
      ctx.addIssue({
        code: "custom",
        path: ["performance", "microExpressionCues", index, "timeSeconds"],
        message: "micro-expression cue must occur before the shot ends",
      });
    }
  });
});

export const ContinuationContractSchema = z.object({
  sourceShotId: z.string().min(1),
  exactFinalFrame: z.string().min(1),
  subjectReference: z.string().min(1),
  preservedState: z.array(z.string().min(1)).min(2),
  firstMotion: z.object({
    mustBeginBySeconds: z.number().positive().max(2),
    action: z.string().min(1),
    visibleResult: z.string().min(1),
  }),
  spatialBridge: z.object({
    completeBySeconds: z.number().positive().max(300),
    sourceGeometry: z.string().min(1),
    transitionMechanism: z.string().min(1),
    destinationGeometry: z.string().min(1),
    cameraPath: z.string().min(1),
  }),
  physicsInvariants: z.array(z.string().min(1)).min(1),
  dialogueCue: z.object({
    startSeconds: z.number().min(0),
    endSeconds: z.number().positive(),
    speaker: z.string().min(1),
    delivery: z.string().min(1),
    mixPriority: z.enum(["foreground", "balanced"]).default("foreground"),
  }).refine((cue) => cue.startSeconds < cue.endSeconds, {
    message: "dialogue cue startSeconds must precede endSeconds",
  }).optional(),
  finalFrameHandoff: z.string().min(1),
  forbiddenTransitions: z.array(z.string().min(1)).default([
    "cut",
    "dissolve",
    "teleport",
    "geometry morphing",
  ]),
}).superRefine((contract, ctx) => {
  if (contract.firstMotion.mustBeginBySeconds >= contract.spatialBridge.completeBySeconds) {
    ctx.addIssue({
      code: "custom",
      path: ["firstMotion", "mustBeginBySeconds"],
      message: "first motion must begin before the spatial bridge completes",
    });
  }
});

export const ContinuationInputSchema = z.object({
  shot: ShotSchema,
  contract: ContinuationContractSchema,
  globalStyle: z.array(z.string().min(1)).default([]),
  globalExclusions: z.array(z.string().min(1)).default([]),
}).superRefine((input, ctx) => {
  if (input.contract.spatialBridge.completeBySeconds > input.shot.durationSeconds) {
    ctx.addIssue({
      code: "custom",
      path: ["contract", "spatialBridge", "completeBySeconds"],
      message: "spatial bridge must complete within the target shot duration",
    });
  }
  if (input.contract.dialogueCue && input.contract.dialogueCue.endSeconds > input.shot.durationSeconds) {
    ctx.addIssue({
      code: "custom",
      path: ["contract", "dialogueCue", "endSeconds"],
      message: "dialogue cue must end within the target shot duration",
    });
  }
  if (input.contract.dialogueCue && !(input.shot.dialogue ?? input.shot.audioTrack.spokenText)) {
    ctx.addIssue({
      code: "custom",
      path: ["contract", "dialogueCue"],
      message: "dialogue cue requires shot.dialogue or audioTrack.spokenText",
    });
  }
  if (input.shot.dialogue && input.shot.audioTrack.spokenText
    && input.shot.dialogue.trim() !== input.shot.audioTrack.spokenText.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["shot", "audioTrack", "spokenText"],
      message: "dialogue and audioTrack.spokenText must contain the same performance",
    });
  }
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
export type GenerationRiskCode = z.infer<typeof GenerationRiskCodeSchema>;
export type DevelopmentRequest = z.infer<typeof DevelopmentRequestSchema>;
export type Optics = z.infer<typeof OpticsSchema>;
export type Capture = z.infer<typeof CaptureSchema>;
export type Performance = z.infer<typeof PerformanceSchema>;
export type Shot = z.infer<typeof ShotSchema>;
export type ContinuationContract = z.infer<typeof ContinuationContractSchema>;
export type ContinuationInput = z.infer<typeof ContinuationInputSchema>;
export type UniversalPacket = z.infer<typeof UniversalPacketSchema>;

const normalizedGestureType = (value: string): string => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

export function assertARollShotPerformance(
  shot: Shot,
  previousGestureTypes: ReadonlySet<string> = new Set<string>(),
): Set<string> {
    if ((shot.dialogue ?? shot.audioTrack.spokenText) && !shot.audioTrack.spokenWindow) {
      throw new Error(
        `A-roll shot ${shot.id} has dialogue without a spoken window; use planARollSpeechWindow before compilation.`,
      );
    }
    const cues = shot.performance.gestureCues ?? [];
    const orderedCues = [...cues].sort((left, right) => left.timeSeconds - right.timeSeconds);
    orderedCues.forEach((cue, cueIndex) => {
      const nextCue = orderedCues[cueIndex + 1];
      if (nextCue && nextCue.timeSeconds - cue.timeSeconds < 8) {
        throw new Error(
          `A-roll shot ${shot.id} places multiple hand gestures inside one eight-second window.`,
        );
      }
    });
    if (["restrained-stillness", "facial-only", "posture-shift"].includes(shot.performance.mode ?? "")
      && cues.length > 0) {
      throw new Error(`A-roll shot ${shot.id} uses ${shot.performance.mode} but also declares a hand gesture.`);
    }
    if (shot.performance.mode === "single-gesture" && cues.length !== 1) {
      throw new Error(`A-roll shot ${shot.id} uses single-gesture mode and must declare exactly one hand gesture.`);
    }
    const currentGestureTypes = new Set<string>();
    cues.forEach((cue) => {
      if (/\b(?:and|or|either)\b|[\/;]/i.test(cue.type)) {
        throw new Error(
          `A-roll shot ${shot.id} has an ambiguous gesture cue; declare one exact physical action instead of alternatives.`,
        );
      }
      const type = normalizedGestureType(cue.type);
      if (currentGestureTypes.has(type)) {
        throw new Error(`A-roll shot ${shot.id} repeats the same gesture cue inside one performance.`);
      }
      if (previousGestureTypes.has(type)) {
        throw new Error(
          `A-roll shot ${shot.id} repeats the previous shot's ${cue.type} gesture; vary performance or use stillness.`,
        );
      }
      currentGestureTypes.add(type);
    });
    return currentGestureTypes;
}

export function assertARollSequencePerformance(packet: UniversalPacket): void {
  if (packet.metadata.format !== "a-roll") return;

  let previousGestureTypes = new Set<string>();
  packet.shots.forEach((shot) => {
    const currentGestureTypes = assertARollShotPerformance(shot, previousGestureTypes);
    previousGestureTypes = currentGestureTypes;
  });
}

export function parseUniversalPacket(input: unknown): UniversalPacket {
  const packet = UniversalPacketSchema.parse(input);
  if (packet.metadata.format !== "a-roll") return packet;
  const routedPacket: UniversalPacket = {
    ...packet,
    shots: packet.shots.map((shot): Shot => ({
      ...shot,
      frameworkId: "avatar-a-roll-json",
    })),
  };
  assertARollSequencePerformance(routedPacket);
  return routedPacket;
}
