# Framework-Native Prompt Architectures

AUTEUR frameworks are executable prompt structures, not labels. The compiler must change the order, language, and required blocks of the generated prompt when `frameworkId` changes.

Use one primary framework for the production problem. Add audio, repair, or continuation through their dedicated surfaces. Do not concatenate all eleven frameworks into one oversized prompt; that destroys hierarchy and makes the generation target ambiguous.

Exact speech should carry `audioTrack.spokenWindow` boundaries so the compiler can forbid early articulation and pre-flight can reject out-of-range timing. Shots with `BRAND_OR_TEXT_CONTROL` compile blankness as a positive material/color state; negative logo and text lists remain necessary but are not treated as sufficient.

Every timed architecture also compiles the same no-anticipation invariant: a later action, dialogue cue, or terminal state cannot appear before its declared beat. Positive surface locks describe the state that must remain visible; they do not enumerate forbidden mark types inside the positive block because those words can increase visual leakage.

Prompt prose is not the final control layer. Before compilation, the route advisor scores compound constraints. A short shot that combines delayed exact dialogue, multiple temporal stages, strict surface control, identity locks, or high-risk choreography can fail pre-flight and route to a split pass. Split at a stable visual handoff instead of deleting framework blocks or adding repetitive negatives.

## Shot compilers

| Framework | Prompt architecture | Use when |
| --- | --- | --- |
| Cinematic Prose Stack | Premise -> reality anchor -> optics and camera -> timed sequence -> expression and exclusions | One premium shot where physical realism, optics, materials, and restraint carry the result |
| Act and Shot Master Spec | Core concept -> themes -> technical master specification -> act/shot block -> continuity spine -> audio -> payoff | A shot belongs to a causal multi-shot production and must retain story function and sequence continuity |
| JSON Scene Contract | Metadata -> scene -> subject -> camera -> lighting -> timeline -> audio -> constraints -> compiled prompt | A host needs parseable, versionable, auditable scene data |
| Avatar A-Roll JSON Contract | Project manifest -> global creative directive -> character/asset bible -> intentional performance mode -> cinematography/optics/psychology -> audio/vocal lock -> triple-lock protocol -> acceptance tests | A referenced speaker must deliver exact dialogue with controlled eye line, non-repetitive human motion, identity, voice intent, sound, and an audited handoff |
| Temporal Evolution | Transformation goal -> initial state -> final state -> immutable keys -> phase plan -> physics -> fail-closed negatives | A visible transformation or VFX state change is the hard problem |
| Timed Social Sequence | Platform and goal -> first-two-second hook -> beat timeline -> visual language -> retention/payoff -> audio/editing -> negatives | Retention, reveal timing, loop, or social pacing is the hard problem |
| Practical Stunt Contract | Core concept -> acquisition stack (sensor, recording, rig, lens, frame rate, shutter) -> reality anchor -> millisecond camera choreography -> mass/contact/momentum -> image science -> synchronized audio -> hard exclusions | Contact, pursuit, rescue, machinery, or stunt physics must feel physically photographed |
| Continuous Take | Exact duration -> identity lock -> camera relationship -> start/middle/end action arc -> lighting/material behavior -> audio -> exclusions | One uninterrupted performance or physical action should read as a real take |
| Audio Contract | Primary source -> visible sync map -> ambience and acoustic space -> mix hierarchy -> music boundary -> exclusions | Audio is the primary generated artifact or the dominant acceptance risk |

## Evidence-specific compilers

Two frameworks deliberately reject a normal `Shot` input:

- **Constrained Repair Pass** requires an observed defect, an explicit physical correction, a preserve list, and a recurrence ban. Use `buildRepairPrompt`.
- **Render-Observed Continuation** requires the accepted render's actual final frame, preserved visible state, first-motion deadline, spatial bridge, physics invariants, and final-frame handoff. Use `compileContinuationPrompt`.

This fail-closed behavior prevents a planned shot from being mislabeled as evidence-led repair or continuation.

## Full and compact surfaces

`videoPrompt` is the canonical framework-native prompt. `compactVideoPrompt` attempts to retain the same framework architecture while flattening whitespace and enforcing the toolkit-owned character budget, then reports any degradation. The 4,000-character budget is not a provider limit.

Always inspect `compactPromptReport`:

- `frameworkPreserved` must be `true`;
- `omittedExclusions` must be empty or handled through another supported control;
- `truncatedSections` must be empty for high-stakes generation.

When any safeguard or block is omitted, submit the full `videoPrompt`, reduce the shot without deleting evidence-bearing constraints, or use a supported separate negative field. Never treat compactness as a quality objective by itself.

## Routing rule

The development contract chooses a primary framework from the creative request. A structured-output model may override a shot only when that shot has a more specific production problem. Provider capability, pricing, duration limits, and prompt limits remain external evidence; a framework route is not a provider capability claim.

`a-roll` is a hard route to `avatar-a-roll-json`. Its audio and identity controls are part of that one JSON contract; `audio-contract` remains a separate primary route for audio-first non-A-roll work. `continuous-take` remains available for unbroken physical action and character-scene problems, but it is not the A-roll fallback.

The A-roll compiler treats timing and performance as contracts, not adjective prose. When exact speech has a declared pace and window, pre-flight verifies `wordCount / paceWpm * 60` with a provider-timing guard. Every shot selects one performance mode: restrained stillness, facial-only, one exact hand gesture, a posture shift, or an object interaction. Cue-free shots disable invented presenter gestures; an eight-second shot may carry at most one unambiguous hand cue; and consecutive shots cannot reuse the same gesture type. Micro-expression cues remain separate from hand choreography.

The terminal protocol now reserves a 0.75-second natural settle and three unchanged terminal frames instead of forcing a long theatrical freeze. This change is grounded in a bounded historical prompt-to-output audit where shorter natural settles produced better relative performance, while repeated precision gestures, symmetrical hand motion, simulated multi-camera coverage, and two-second freezes produced visible defects. Voice-profile, pitch, loudness, onset, and lip-sync fields remain generation intent until the returned media is measured. See [`a-roll-historical-output-audit-2026-07-22.json`](evidence/a-roll-historical-output-audit-2026-07-22.json).
