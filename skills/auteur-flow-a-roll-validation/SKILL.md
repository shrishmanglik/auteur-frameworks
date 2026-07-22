---
name: auteur-flow-a-roll-validation
description: Compile, dispatch, audit, repair, and chain AUTEUR avatar A-roll shots in Google Flow or a comparable provider UI. Use for exact-dialogue talking heads, voice and performance locks, render-observed continuation frames, provider prompt-provenance checks, and evidence-bound 60-second sequence assembly.
---

# AUTEUR Flow A-roll Validation

Run one segment at a time. Never queue the next segment before the current return passes the applicable gate.

## Inputs

- an `avatar-a-roll-json` production kit;
- the approved speaker or accepted prior boundary frame;
- exact dialogue for one bounded segment;
- provider/model/duration/aspect shown at dispatch;
- a writable evidence directory outside the public package.

## Dispatch gate

1. Run toolkit validation and pre-flight. Require `compactPromptReport.frameworkPreserved === true`, no omitted exclusions, and no truncated sections.
2. Inspect the A-Roll JSON 2.0 performance contract before dispatch:
   - select exactly one performance mode for the shot;
   - use restrained stillness when no physical action serves the sentence;
   - allow at most one exact hand gesture in eight seconds;
   - never encode alternatives such as `pinch or open palm`;
   - never repeat the previous segment's gesture type;
   - keep micro-expression cues separate from hand movement.
3. Attach the required identity or accepted boundary frame to the correct start/reference slot.
4. Set duration and aspect explicitly. Record the provider/model label and visible cost; do not turn session observations into permanent capability claims.
5. Put exactly one compiled prompt surface into the provider field.
6. Verify the controlled editor state, not only visible text:
   - a real text leaf exists;
   - no zero-width placeholder owns the field;
   - committed length or hash matches the compiled prompt;
   - text survives blur unchanged;
   - the final create control is enabled without forcing it.
7. Submit one variation.
8. Open the returned media detail and verify prompt provenance: expected manifest version, framework ID, and exact dialogue. Exclude a return whose recorded prompt is empty, truncated into a different contract, or only a seed character.

For Flow's Slate editor, ordinary fill, simulated typing, or paste can look correct while failing step 5. Use the browser's supported native text-insertion path when required, then run every state check again. Transfer focus with a keyboard action or a uniquely identified control; never use an unverified fixed-coordinate click to blur the editor because it can open another media card and silently discard the staged prompt. Do not encode this provider behavior as a general provider limit.

## Returned-media audit

Download the original asset and record its hash. Measure or inspect:

- media duration, frame rate, dimensions, and audio streams;
- word-for-word transcript and speech window;
- identity, wardrobe, set, crop, focus, light, and microphone continuity;
- restrained phrase-motivated hand, head, shoulder, breath, blink, and eye motion;
- whether the declared performance mode manifested without invented or repeated presenter motion;
- lip/jaw/throat synchronization when a validated scorer or qualified human review exists;
- integrated loudness, true peak, and approximate pitch as observations, not biometric identity proof;
- the final second at frame-level density.

Use `planARollPostflight`. Exact-dialogue, identity, or proven fine-sync failure regenerates. Numeric mix miss routes to deterministic mastering and re-measurement. A terminal defect can be trimmed only when at least three consecutive post-speech frames prove a closed-lip, open-eye stable span. Re-audit the derivative before using it.

## Continuation gate

Advance only from an accepted render or re-audited derivative. Save one frame inside the proven stable span and describe its observed state. The next prompt must preserve:

- exact boundary pixels, identity, wardrobe, set, optics, crop, gaze, and light;
- the sequence-level voice anchor rather than the latest clip's accidental drift;
- no jump, dissolve, reframe, pose reset, or voice reset;
- one natural inhale or other physically continuous bridge before dialogue.

If the provider's native extend control is disabled, do not force it. A start-frame generation is a chained reference-first clip, not proof of native extension continuity.

## Learning loop

Classify every defect as `compiler`, `dispatch`, `provider`, `post-flight`, or `UNKNOWN`. Repair one causal variable. A new render counts as improvement only when the same rubric score rises; never invent a percentage. Treat voice profile, pitch, loudness, onset, and lip sync as authored intent until the returned media is measured. Stop prompt-only retries for a repeated provider miss when deterministic post-flight or a different route is the honest fix.

## Closeout

Report prompt provenance, hashes, transcript, measured audio, visual findings, accepted trim boundary, exclusions, unresolved `UNKNOWN`s, and whether continuation is authorized. Never publish raw private prompts, media, account identifiers, or local paths.
