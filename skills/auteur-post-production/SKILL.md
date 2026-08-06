---
name: auteur-post-production
description: Plan, assemble, audit and hand off spoken A-roll edits with content-addressed sources, phrase-safe trims, selective overlays, narrative B-roll, colour matching, audio mastering, upscale labeling and separate craft approval. Use for application videos, founder monologues, podcasts, explainers and other edited talking-head sequences.
---

# AUTEUR post-production

Use this skill after a spoken script exists or source clips have returned. Keep generation and editorial responsibilities separate.

## 1. Plan each spoken source

Run `auteur-frameworks plan-spoken` with the exact script, one performance cue, pace and caller-verified duration options. Use the selected smallest supported container. Never copy the script into another prompt field.

## 2. Audit returned source media

Record SHA-256, approved script, observed transcript, duration and identity, lip-sync, dialogue and terminal observations. Regenerate material dialogue, identity or lip-sync failures. Salvage only phrase gaps, clean tails, terminal settle or measured mix differences, then re-audit the derivative.

## 3. Build the edit plan

- Join sources by stable ID, SHA-256 and transcript, never by filename order.
- Cut only at verified phrase boundaries.
- Give every B-roll shot and transition one narrative purpose.
- Never use B-roll to hide a material source failure.
- Use overlays as selective meaning units, not full karaoke captions.
- Keep generation footage free of captions and add typography externally.
- Lock a colour reference and declare audio and picture delivery targets.
- Label enlarged delivery as presentation upscale.

## 4. Verify bad controls first

Prove the plan rejects:

- repeated approved speech;
- B-roll that conceals a material source failure;
- self-review;
- a native-resolution claim on enlarged output;
- an overlay without safe-area and rendered-pixel review;
- a cut without a verified phrase boundary.

Then run the clean audit twice.

## 5. Inspect the rendered edit

Decode the full file. Inspect at least one frame per second and every declared boundary. Check overlay pixels at output resolution. Watch the complete edit at full speed with sound. Measure the final audio stream and compare the delivery with the approved master.

## 6. Separate verdicts

Author deterministic proof is not craft approval. Route the frozen result to a different-session reviewer. Keep founder acceptance separate. A failed independent or founder verdict is `REVISE` even when technical checks pass.

## Closeout

Return source hashes, edit-plan hash, measured picture and audio facts, failed and clean controls, reviewer identity, verdict, and unresolved unknowns. Never publish raw private prompts, media, account identifiers or local paths.
