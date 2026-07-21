export const FAILURE_REPAIRS = {
  STATIC_FRAME: "Require one measurable subject, camera, or material state change from opening through midpoint to final frame.",
  TYPOGRAPHY_CORRUPTION: "Generate a text-free plate with reserved negative space; composite approved copy after generation.",
  TEMPORAL_INCONSISTENCY: "Lock identity, wardrobe, geometry, lighting direction, and object inventory across every beat.",
  ANATOMY_ERROR: "Keep hands visible and task-anchored; preserve stable joint count, proportions, contact, and grip.",
  MORPHING_WARPING: "Use one continuous physically motivated action; forbid morphing, warping, and topology changes.",
  IDENTITY_DRIFT: "Describe identity once, attach references where supported, and keep defining features unobscured.",
  PHYSICS_VIOLATION: "Name mass, momentum, gravity, friction, contact points, and the physically changed final state.",
  LIP_SYNC_FAILURE: "Use short dialogue beats, visible phoneme-friendly framing, and explicit speech synchronization.",
  DIALOGUE_OMITTED: "Time-box one named speaker, quote the exact line once, forbid paraphrase or repetition, and mix intelligible speech above ambience.",
  BRAND_LEAKAGE: "Specify unbranded surfaces and forbid logos, trademarks, and unintended copy.",
  SCALE_INCONSISTENCY: "Anchor scale with a familiar reference object and preserve physical dimensions across shots.",
  DURATION_MISMATCH: "Align the temporal plan to the configured duration and assign every beat an exact window.",
  AUDIO_MISSING_OR_BAD: "State dialogue, foley, ambience, music boundary, acoustic space, and sync points explicitly.",
  ACTION_SUBSTITUTION: "Pin actor, verb, object, contact moment, and completed result state.",
  MATERIAL_DRIFT: "Lock material, finish, wear, reflectance, and deformation behavior before motion.",
  OBJECT_CONSERVATION: "List persistent objects and require each to remain present unless a visible action removes it.",
  TOPOLOGY_DRIFT: "Protect branches, appendages, cables, joints, and repeated structures through every angle.",
  MATCH_FRAME_DRIFT: "Use the accepted render's final frame as frame zero; preserve camera, pose, scale, screen direction, lighting, and geometry until the first visible motion begins.",
  CAMERA_PATH_JUMP: "Use one camera body and lens, then describe the visible physical camera path between compositions; forbid lens, height, axis, reverse-angle, and coverage jumps.",
  CONTINUATION_BRIDGE_BREAK: "Begin one irreversible motion inside the first second, preserve source geometry, and show the physical camera path into the destination without a cut, dissolve, teleport, or morph.",
  PUBLIC_FIGURE_NAME_COLLISION: "For an original fictional character rejected as a prominent person, remove the unsupported proper name and preserve identity through role, wardrobe, face, object, and state locks; never imply a real person.",
} as const;

export type FailureCode = keyof typeof FAILURE_REPAIRS;

export interface RepairRequest {
  failure: FailureCode;
  observedSymptom: string;
  preserve: string[];
}

export function buildRepairPrompt(request: RepairRequest): string {
  return [
    "REPAIR ONLY: " + request.observedSymptom,
    "CORRECTION: " + FAILURE_REPAIRS[request.failure],
    "PRESERVE: " + request.preserve.join("; ") + ".",
    "FORBID RECURRENCE: " + request.failure.toLowerCase().replaceAll("_", " ") + ".",
  ].join("\n");
}
