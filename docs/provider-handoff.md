# Provider Handoff

The core package is provider-neutral. This guide describes a safe manual handoff pattern, not a claim about any provider's current product limits.

## Before submission

1. Run `validate` and `preflight`.
2. Choose one shot, not an entire sequence, unless the provider workflow explicitly supports sequences.
3. Confirm duration and aspect ratio in the provider interface.
4. Attach identity, object, or final-frame references only through supported controls.
5. Preserve the packet version and shot ID in your own job ledger.

## Prompt surfaces

- **videoPrompt**: motion, temporal beats, optics, lighting, physics, continuity, audio intent, and exclusions.
- **framePrompt**: a reference-frame or image-generation description without temporal choreography.
- **audioPrompt**: spoken performance, sound design, and music boundary when present.
- **negativePrompt**: exclusions for systems or adapters that expose a separate negative field.

The `videoPrompt` already contains exclusions. Do not append the same negative list twice.

## Manual Flow-style smoke

For a single-shot video workflow:

1. set the configured duration to the shot's `durationSeconds` when available;
2. set the packet's aspect ratio;
3. paste `videoPrompt` into the creation field;
4. submit one variation first;
5. evaluate action completion, geometry, physical behavior, identity, audio, and final state;
6. use `buildRepairPrompt` for one observed defect at a time.

Provider models, controls, costs, and capabilities change. Treat the interface shown at runtime as provider evidence for that session, not as a permanent compiler rule.

## Result review

Record:

- packet version and shot ID;
- provider and model label shown at submission;
- configured duration and aspect ratio;
- reference assets attached;
- observed completion state;
- continuity defects;
- physics/material defects;
- audio/sync defects;
- repair decision.

Never place credentials, account identifiers, private source paths, or customer media inside the Universal Packet.
