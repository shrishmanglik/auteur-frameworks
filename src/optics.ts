import type { Optics } from "./schemas.js";

export function depthOfFieldCharacter(optics: Optics): string {
  const shallowScore = (optics.focalLengthMm / 50) * (2.8 / optics.tStop)
    * (3 / optics.subjectDistanceMeters);
  if (shallowScore >= 2.2) return "very shallow depth of field with rapid falloff";
  if (shallowScore >= 1.0) return "shallow depth of field with controlled subject separation";
  if (shallowScore >= 0.45) return "moderate depth of field with readable environment";
  return "deep focus with foreground-to-background legibility";
}

export function opticsToProse(optics: Optics): string {
  const body = optics.cameraBody ? "Shot on " + optics.cameraBody : "Shot on a cinema camera";
  const lens = optics.lensModel ? optics.lensModel + ", " : "";
  return body + " with " + lens + optics.focalLengthMm + "mm optics at T" + optics.tStop
    + ", camera " + optics.subjectDistanceMeters + "m from subject, "
    + depthOfFieldCharacter(optics) + ".";
}
