# Changelog

All notable public changes are recorded here. The project follows semantic versioning while the API matures; versions below `1.0.0` may contain documented breaking changes.

## 0.8.0 - 2026-07-21

### Fixed

- Corrected the A-roll route from the generic `continuous-take` prose compiler to a dedicated `avatar-a-roll-json` architecture.
- Added optional performer controls for posture, eye line, delivery, lip movement, head movement, jaw movement, and expression source.
- Added optional vocal controls for voice-reference ID, language, pace, delivery, phoneme-alignment acceptance target, and mix intent.
- Added a compact JSON handoff that retains the project manifest, character/asset bible, performance manifest, optics, vocal lock, triple-lock protocol, constraints, and acceptance tests without dropping exclusions.

### Evidence

- A bounded re-audit of the private 910-record Flow prompt corpus found 131 A-roll, avatar, presenter, monologue, dialogue, or lip-sync records classified as JSON cinematic scene contracts with audio; 97 parsed as strict JSON. Recurrent lineages included Vocal Lock, Facial Constraint Protocol, Viral Monologue Execution, and Triple Lock. The aggregate, hash-pinned audit is published without raw prompts or private identifiers in `docs/evidence/a-roll-json-architecture-2026-07-21.json`.
- The prior `a-roll -> continuous-take` route is treated as a synthesis defect. Its generated media may still inform failure analysis, but it is not evidence that the corrected A-roll architecture has been validated.

## 0.7.2 - 2026-07-21

### Fixed

- Added `DELAYED_TERMINAL_REVEAL` routing. When an explicit terminal frame introduces visible inventory absent from the explicit opening frame, the original single-pass prompt is blocked and the route becomes a split pass.
- Added `buildDelayedRevealSplitPlan`: it compiles a framework-native pre-reveal prompt from opening-only structured data, rejects terminal-term leakage, and requires the reveal extension to be compiled from the accepted pre-reveal render's observed final frame.
- Added rejection gates for terminal inventory in pre-reveal prompts or pixels and for reset, reframe, teleport, dissolve, geometry morph, or omitted reveal in the continuation. Provider frame/edit support remains runtime evidence, not a claimed capability.

### Evidence

- The v0.7.1 opening asset correctly omitted the bell, but the reference-first Flow render still materialized it in frame zero because the terminal object remained named in the full video contract. The render scored 72.4/100 versus the 71.2 baseline, below the required 10% improvement. Three attempted terminal endpoints then substituted the interaction, changed camera/identity geometry, or duplicated/detached a tank. A v0.7.2 exact-first-frame retry used the verified clean opening asset yet changed camera and subject pose before frame zero and materialized the bell immediately. This patch therefore isolates the terminal object's vocabulary and assets into a later render-observed continuation instead of claiming a first-frame control solved the provider failure.

## 0.7.1 - 2026-07-21

### Fixed

- Split frame compilation into `openingFramePrompt` and `terminalFramePrompt`; the existing `framePrompt` now aliases the opening state for backwards compatibility.
- Added explicit opening-only and terminal-only `frameStates` data. Opening compilation never reuses composite environment, material, imperfection, or continuity fields; absent explicit data is labeled `minimal-fallback` and warned in pre-flight.
- Added a route-asset requirement and acceptance check that rejects reference-first opening frames contaminated by a later beat.
- Extended opening-state fallback warnings to first/last-frame routes and added a terminal-state fallback warning wherever that route consumes a final-state asset.

### Evidence

- A route-compliant `cinematic-prose-stack` Flow render preserved one diver, clean tanks, wreck geometry, buoyancy, bubbles, silt, lamp falloff, and nonverbal audio, but scored 71.2/100 and was rejected: the bell and lamp-to-bell relationship were already visible in frame zero, collapsing the requested 6-8 second discovery. The scene reference had encoded the terminal reveal. This patch separates opening and terminal frame evidence instead of adding more video-prompt wording.

## 0.7.0 - 2026-07-21

### Added

- Added typed render-audio verification for exact speech, no-speech, and nonverbal contracts. Failed verification is a critical defect; missing evidence or an audio rubric score below 3/5 prevents production acceptance even when the weighted score is high.
- Documented VAD-aware review for instrumental and environmental tracks so unconstrained transcription hallucinations are retained as diagnostics rather than accepted as speech.
- Added an affirmative surface lock to every generated reference-frame prompt so route assets do not silently omit the clean-material state enforced by the video contract.

### Evidence

- The first route-compliant framework-native Flow run used a generated identity reference and a `continuous-take` prompt. It preserved performer identity, hand-to-instrument interaction, one uninterrupted action arc, and requested nonverbal sound, scoring 95/100. VAD-enabled transcription found no speech; a no-VAD decode hallucinated a sentence from the trumpet audio, which exposed the need for an explicit audio-evidence gate.
- A subsequent `cinematic-prose-stack` reference generation produced a credible diver and shipwreck but invented markings on otherwise unspecified equipment surfaces. The reference was rejected before video dispatch; the finding moved clean-surface control into frame-prompt compilation rather than adding more video-only negative wording.

## 0.6.0 - 2026-07-21

### Added

- Added a deterministic shot constraint budget to route advice, with scored factors for multi-stage action, delayed exact dialogue, strict surface control, identity locks, and high-risk choreography.
- Added a blocking `SHOT_CONSTRAINT_OVERLOAD` pre-flight issue and `COMPOUND_CONSTRAINT_OVERLOAD` split-pass route when a short shot exceeds the provider-neutral safety budget.

### Evidence

- A third framework-native Flow render preserved one continuous take, identity, physical materials, and exact words, but opened the door before frame one, spoke 1.32 seconds early, rendered dialogue as subtitles, and invented a roof mark. It scored 76/100 and was rejected. The repeated failure proves that route overload, not missing negative prose, is the next control problem.

## 0.5.2 - 2026-07-21

### Fixed

- Compiled a no-anticipation temporal boundary rule across all eight shot architectures so later actions, dialogue, and terminal states cannot begin before their declared beat.
- Replaced forbidden-token enumeration inside the positive surface-control block with affirmative material, color, finish, and geometry continuity.
- Kept dialogue instructions in the audio domain and described the image as a clean picture plate to reduce visual transcription leakage.

### Evidence

- The first timing/surface repair produced exact audio but still spoke 0.70 seconds early, closed a locked-open door, retained vehicle pseudo-lettering, and added visible dialogue subtitles. It scored 81/100 versus the prior 92/100 and was rejected; v0.5.2 addresses those generalized failures without claiming provider compliance.

## 0.5.1 - 2026-07-21

### Added

- Optional `audioTrack.spokenWindow` boundaries, compiler timing language, and pre-flight checks for early or out-of-range dialogue.
- Positive blank-surface production-design locks for shots carrying `BRAND_OR_TEXT_CONTROL`, supplementing negative text/logo exclusions.

### Evidence

- A framework-native authenticated Flow run completed as one continuous eight-second take with exact speech, but invented cab lettering and began speech 0.83 seconds early. The render was rejected; these two generalized repairs came from that observed media rather than provider assumptions.

## 0.5.0 - 2026-07-21

### Fixed

- Replaced the label-only generic shot compiler with distinct corpus-derived architectures for cinematic prose, act/shot master specifications, JSON scene contracts, temporal evolution, timed social sequences, practical stunts, continuous takes, and audio-first work.
- Made compact prompts preserve the selected framework structure and report `frameworkPreserved`; high-stakes handoff guidance now rejects truncated blocks or omitted safeguards.
- Made repair and render-observed continuation fail closed through the generic shot compiler so they cannot be claimed without observed-defect or final-frame evidence.
- Canonicalized exact dialogue so the framework prompt contains the approved line once even when the source action also names it.

### Added

- Machine-readable compiler-surface and architecture-style metadata for every framework.
- Optional capture-stack fields for sensor format, recording format, rig, frame rate, shutter angle, and resolution intent; existing packets hydrate with an empty capture object.
- Explicit development-request routes for practical choreography, machine-readable scene contracts, and audio-first production.
- Explicit route and QC contracts for multi-subject dynamics, measurable spatial clearance, and frame-accurate action/audio synchronization; tightened mechanical-assembly inference so clothing and seated performers do not trigger a false route.
- Cross-framework regression tests proving that one shot compiles into materially different prompt structures.
- Public architecture guide and a correction limiting the pre-0.5 Flow matrix to routing and QC evidence.

## 0.4.0 - 2026-07-21

### Added

- One-command complete production kit with story, scene plan, character and world bibles, style bible, storyboard, shot list, sound plan, continuity matrix, reference assets, prompt package, pre-flight, repairs, and export manifest.
- Risk-aware route advisor for causal contact, precise assembly, exact fluid counts, brand/text control, identity/performance, transformations, and exact dialogue.
- Render-observed performance-exaggeration repair guidance.
- Sanitized maintainer-reported ten-run Flow session manifest spanning reel comedy, A-roll dialogue, product mechanics, automotive, food fluids, and VFX.

### Changed

- Compact prompts prioritize shot-specific safeguards before generic global exclusions.
- High-risk route recommendations retain provider capability as `UNKNOWN` until the host verifies support.

## 0.3.0 - 2026-07-21

### Added

- Render-Observed Continuation framework and deterministic continuation compiler.
- First-motion deadline, source-to-destination spatial bridge, physics invariants, and final-frame handoff contracts.
- Render-observed match-frame and single-camera-path guards for extension boundaries.
- Repair guidance for match-frame drift and camera-path jumps.
- Optional time-boxed dialogue cues with exact-line and foreground-mix guards.
- Repair guidance for omitted requested dialogue.
- Provider-safe repair guidance for fictional character names that collide with prominent-person controls.
- CLI `continue` command plus a synthetic extension fixture.
- Generated JSON Schema for render-observed continuation input.
- Evidence-scoped Flow extension smoke with three same-shot refinement cycles above the 10% project threshold.

## 0.2.0 - 2026-07-21

### Added

- Git-based installation build hook.
- Deterministic compact provider-handoff prompt alongside the full production contract.
- Typed render scoring and relative cycle-comparison utilities for evidence-bound refinement.
- CLI help, version, framework registry, and raw-brief development commands.
- Creative mandate, must-include, and cliché-avoidance request fields.
- Short-film, vertical-reel, A-roll, and request fixtures.
- Multi-persona evaluation suite and isolated packed-consumer smoke.
- Quickstart, LLM integration, provider handoff, evaluation, governance, support, and citation documentation.
- Production-duration and scene/shot ownership pre-flight checks.

### Changed

- Spoken dialogue and `audioTrack.spokenText` compile into one canonical performance.
- Compiler punctuation no longer emits doubled terminal punctuation.
- CI uses current official GitHub action majors.

## 0.1.0 - 2026-07-21

- Initial public framework registry, Universal Packet schema, compiler, storyboard projection, pre-flight QC, repair engine, CLI, synthetic product-film example, publication audits, and Apache-2.0 release.
