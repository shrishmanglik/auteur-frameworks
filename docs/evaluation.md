# Evaluation Methodology

The project uses executable creator fixtures rather than a single generic demo. These are role-based expert lenses and automated acceptance tests, not a claim that external filmmakers were interviewed or endorsed the project.

## Expert viewpoints

### Narrative director

Fixture: `examples/short-film.json`

Checks causal beats, scene purpose, character continuity, physical investigation, audio motivation, and an earned final choice.

### Commercial director

Fixture: `examples/product-film.json`

Checks that product value is expressed through materials, light, optics, physical behavior, and a clean final state rather than empty adjectives.

### Vertical creator

Fixture: `examples/vertical-reel.json`

Checks the first-second hook, 9:16 composition, short temporal windows, loop construction, and generated-text risk.

### A-roll operator

Fixture: `examples/a-roll.json`

Checks continuous-take grammar, spoken-performance deduplication, evidence-led dialogue, eye line, room sound, and natural imperfection.

### Tool integrator

Fixtures: `examples/requests/*.json`

Checks development routing, JSON Schema output, actionable CLI errors, clean package import, and deterministic compilation.

## Automated gates

```bash
npm run test
npm run typecheck
npm run docs:check
npm run audit:public
npm run audit:package
npm run test:consumer
```

## Acceptance rules

A creator packet must:

- parse against the Universal Packet schema;
- have contiguous shot beats beginning at zero;
- fill each shot's duration exactly;
- make total shot duration equal the production target;
- maintain consistent scene/shot ownership;
- include at least two observable continuity locks;
- include at least two physical imperfection anchors;
- define audio when the production requires it;
- compile one storyboard panel and prompt record per shot;
- keep global exclusions in every compiled shot exactly once.

Warnings may pass pre-flight when they describe an explicit production choice, such as generated-text risk. Errors block handoff.

## Provider smoke

Provider smoke tests are separate from deterministic package tests. They must record the account boundary, provider/model label, visible cost, duration/aspect settings, submitted-shot summary and cryptographic fingerprint, exact-prompt fingerprint, result, and limitations of the evidence. A prompt fingerprint preserves auditability without publishing proprietary or session-specific prompt text. One provider result cannot prove universal model performance.

## Render refinement rubric

Record each observed result as a `RenderObservation` and score six criteria from 0 to 5:

| Criterion | Weight |
| --- | ---: |
| Prompt adherence | 20% |
| Temporal completion | 20% |
| Continuity | 15% |
| Physical and material realism | 20% |
| Cinematography | 15% |
| Audio | 10% |

Use `auteur-frameworks score-render observation.json` for the weighted score. Use `auteur-frameworks compare-renders before.json after.json` to calculate relative improvement. A refinement cycle meets the project threshold only when the measured score rises by at least 10% relative to the immediately preceding render of the same shot. A critical defect always blocks the result regardless of score.

Scores are observations, not model capability claims. Preserve the provider/model label visible at runtime and state whether review was human, vision-assisted, or both in `evidenceNote`.

## Maintainer live smoke: Flow extension loop

On 2026-07-21, maintainers ran a synthetic science-fiction trailer through the authenticated Google Flow interface labeled `Veo 3.1 - Lite`. Each prompt was compiled separately, submitted as one extension, inspected, scored, repaired in the framework, and then rerun. The accepted sequential path reached 29 seconds; rejected and diagnostic variants were excluded from that path.

| Same-shot cycle | Before | After | Relative gain | Observed repair |
| --- | ---: | ---: | ---: | --- |
| Shot 2 spatial bridge | 61.9 | 79.6 | 28.6% | Replaced an omitted hatch transition with a visible source-to-destination bridge. |
| Shot 3 camera continuity | 74.6 | 83.2 | 11.5% | Removed overhead and frontal coverage jumps with one physical camera path. |
| Shot 4 dialogue | 78.5 | 92.5 | 17.8% | Moved a time-boxed exact line ahead of visual detail; local VAD-enabled transcription recovered `Don't bring it home.` once at 2.45-4.45 seconds. |

The scores were maintainer-assigned with visual frame inspection and deterministic rubric calculation. Audio verification used local `faster-whisper` transcription; stream presence alone was not accepted as speech evidence.

This smoke does **not** prove a permanent Flow capability, exact frame-zero matching, cross-provider performance, a completed 60-second trailer, or universal cinematic quality. One tested extension still restaged frame zero despite the match instruction. Provider behavior, UI controls, and model labels may change, so reproduce the loop and retain `UNKNOWN` for anything not observed in the returned asset.

## Maintainer live smoke: rapid cross-format Flow matrix

On 2026-07-21, maintainers submitted ten separately compiled eight-second generations through an authenticated Google Flow interface showing `Veo 3.1 - Fast`, one variation at a time. The visible submission cost was 10 credits per generation. Runs 1-2 used 9:16; runs 3-10 used 16:9. Every prompt came from the public compact compiler. Each returned asset was downloaded, sampled at one frame per second, and reviewed against its shot contract. Exact A-roll speech was additionally checked with local `faster-whisper` transcription. The sanitized, session-scoped evidence manifest is [`flow-rapid-matrix-2026-07-21.json`](evidence/flow-rapid-matrix-2026-07-21.json).

| Run | Production lens | Result | Evidence-led decision |
| ---: | --- | --- | --- |
| 1 | Vertical comedy baseline | Blocked | Stable actor and board, but the requested door-to-board contact was replaced by a static pose and exaggerated reaction. |
| 2 | Vertical comedy repair | Needs repair | Opening state and restrained expression improved; causal contact and completed pinning still did not occur. |
| 3 | A-roll dialogue | Production candidate | One stable watchmaker, credible hand work, exact line recovered once at 2.74-5.74 seconds, no subtitle or coverage change. |
| 4 | Product mechanics baseline | Blocked | Glass, droplet, and commercial finish passed; cap began seated and skipped its lowering path. |
| 5 | Product mechanics repair | Blocked | Text-only repair regressed into a sideways bottle, duplicated cap, and invented camera mark. |
| 6 | Automotive baseline | Blocked | Hairpin motion, wheel contact, spray, and camera continuity passed; recognizable badging and plate text leaked. |
| 7 | Food-fluid baseline | Needs repair | Food identity, steam, and appetite craft passed; liquid became strands and extra drips, and a fingertip entered frame. |
| 8 | Controlled VFX | Production candidate | One rust patch visibly shed into particles and resolved as a compass while actor and environment remained stable. |
| 9 | Automotive brand repair | Production candidate | Original anonymous body design removed visible marks while preserving the accepted stunt and camera behavior. |
| 10 | Food-fluid repair | Needs repair | Three initial beads became more than three drips/strands; exact fluid count remained unreliable in one text-only pass. |

Three of ten renders cleared the harsh production-candidate gate. This is a maintainer-reported session observation, not an independently reproducible pixel audit or provider win rate: the matrix deliberately targeted failure-prone actions, used one sample per prompt, and did not attach references. It is evidence for workflow routing.

The matrix changed public framework behavior:

- compact compilation now retains shot-specific failure safeguards before generic exclusions;
- precise assembly and causal contact route to first/last-frame workflows;
- exact fluid counts route to split passes or frame-by-frame forensic QC rather than a text-only guarantee;
- brand and identity control route to reference-first workflows;
- exaggerated actor reactions have a dedicated constrained repair;
- exact speech is accepted only after transcription, not from audio-stream presence;
- a failed repair is recorded as a regression and never relabeled as a 10% gain.

Provider controls and results are session-scoped evidence. The ten returned media files, account state, raw prompts, and private identifiers are intentionally excluded from the repository.
