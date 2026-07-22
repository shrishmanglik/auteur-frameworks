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

Checks the JSON performance manifest, spoken-performance deduplication, evidence-led dialogue, facial-motion limits, vocal lock, eye line, room sound, and natural imperfection.

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

Production acceptance also requires an explicit `audioVerification` result. Declare whether the contract expects exact speech, no speech, or nonverbal sound, then record the method and evidence. A failed audio check is a critical defect. A missing or `not-run` check caps an otherwise high-scoring render at `needs-repair`; a `verified` result also requires an audio rubric score of at least 3/5. An audio stream by itself is never proof that the requested sound occurred.

For instrumental or environmental audio, combine a VAD-enabled speech scan with waveform, timing-envelope, and spectral inspection. Do not accept unconstrained transcription as speech evidence when it is decoding music or noise: retain the transcript as diagnostic evidence, compare its no-speech probability, and fail only when the speech finding is supported by the audio review.

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

**Architecture correction:** those ten runs used the pre-0.5 compact compiler, which flattened every `frameworkId` into the same generic `Intent / Scene / Camera / Beats / Light / Physics / Lock / Audio / Avoid` envelope. The runs remain valid evidence for returned-media defects, route advice, and QC rules, but they do not validate framework-native prompting. Version 0.5 replaces that label-only behavior with distinct framework compilers and regression tests; new provider validation must submit the corrected `videoPrompt` surface.

### A-roll architecture correction

A later bounded re-audit found that the public toolkit still routed `a-roll` to generic continuous prose even though the private Flow corpus repeatedly encoded avatar, presenter, monologue, dialogue, and lip-sync work as JSON performance contracts. Of 910 private Flow prompt records, 131 matched the A-roll topic filter while carrying the `JSON cinematic scene contract with audio` classification; 97 parsed as strict JSON. Recurrent lineages included Vocal Lock, Facial Constraint Protocol, Viral Monologue Execution, and Triple Lock.

Version 0.8 therefore routes A-roll to `avatar-a-roll-json`. The full contract retains a project manifest, creative directive, character/asset bible, performance limits, optics and psychological framing, audio/vocal lock, script-identity-temporal triple lock, and acceptance tests. Its compact surface remains JSON and must preserve every exclusion. The aggregate, hash-pinned audit is [`a-roll-json-architecture-2026-07-21.json`](evidence/a-roll-json-architecture-2026-07-21.json); it publishes no raw prompts or private identifiers.

Any A-roll render produced through the former `continuous-take` route is retained only as failure evidence. It does not validate the corrected architecture. Provider quality remains unproven until a new JSON-native render is downloaded and audited.

The first v0.8 JSON-native Flow run did not clear that gate. It reproduced the approved line once and kept identity, set, camera, wardrobe, light, and microphone broadly stable, but local transcription placed speech at 0.00-6.90 seconds instead of the declared 0.40-7.40 seconds. A 0.735-second silent tail appeared, yet the terminal frame reopened the mouth. Independent rubric review scored the new render 20.5/30 versus 19.5/30 for the superseded prose baseline, a 5.1% relative gain. Both remained blocked by timing and terminal-handoff defects, and no continuation was generated.

That audit exposed a deterministic packet defect as well as provider non-adherence: 18 words at 138 WPM require about 7.83 seconds, while the packet allowed 7.0 seconds. Version 0.8.1 blocks contradictory word-count, pace, and speech-window combinations; reserves an explicit terminal frame pad; and carries a corpus-derived lip-sync confidence acceptance target. The sanitized observation is [`a-roll-json-flow-cycle-2026-07-21.json`](evidence/a-roll-json-flow-cycle-2026-07-21.json).

The v0.8.1 retry also failed. It matched the revised approved sentence exactly once and kept the reference composition broadly stable, but the decoded face reopened its mouth after speech and ended mouth-open with unstable eyelids at both 7.70 seconds and the final decoded frame. Independent review scored it 19/30 versus 21/30 for v0.8.0, so continuation remained blocked. Version 0.8.2 therefore reserves a 1.5-second post-phoneme settle window and encodes a no-reopening terminal state. This is a testable repair hypothesis, not a claimed provider capability.

The compact v0.8.3 contract then returned a valid eight-second Flow asset and reproduced its 13-word sentence exactly once. Local transcription measured 0.27-6.83 seconds, about 119 effective WPM despite a declared 138 WPM. Identity and set remained stable, but the last decoded frame reopened the mouth and entered a blink. Version 0.8.4 therefore applied a 1.2x speech-timing guard and reserved two terminal seconds.

The v0.8.4 retry reproduced its shorter 11-word line exactly once from 0.62-6.16 seconds, materially improving the speech boundary. It still ended with parted lips and lowered eyelids. Its audio measured about -19.84 LUFS integrated and -0.36 dBFS true peak, while the source packet intended -14 LUFS and -1 dBFS; inspection showed that compact compilation had omitted the authored mix object. Version 0.8.5 carries the complete voice and mix signature, adds bounded hand/head/body micro-performance controls, and divides the post-speech interval into a natural closed-mouth settle followed by a 0.75-second strict boundary lock. These remain repair hypotheses until a returned asset passes review.

The v0.8.5 return met the exact-dialogue window at 0.00-5.72 seconds, preserved the reference composition, and produced natural bounded hand and head motion. It still ignored the numeric mix intent (-22.59 LUFS / -2.84 dBFS observed) and restarted mouth motion around 7.5 seconds. Repeated prompt-only terminal and loudness repairs therefore stop. Version 0.8.6 adds a deterministic post-flight planner: transcript, identity, or fine lip-sync failure regenerates; a proven post-speech stable frame may route to trim/master/re-audit; missing evidence remains manual review. The 7.466-second derived salvage candidate pending re-audit measured -14.07 LUFS / -1.64 dBFS and ended closed-lip/open-eye, but continuation still requires explicit fine lip-sync and subjective voice review and does not retroactively prove provider adherence.

### Framework-native rejection loop

Maintainers then submitted three full `continuous-take` prompts for the same rain-cab contract. All three returned continuous eight-second H.264/AAC media with exact speech, plausible wet materials, and stable identity; all three were rejected. The first scored 92/100 but invented vehicle lettering and spoke 0.83 seconds early. The timing/surface repair scored 81/100, retained lettering, added visible subtitles, closed a locked-open door, and still spoke 0.70 seconds early. The no-anticipation/affirmative-surface repair scored 76/100: the door was already open in frame one, speech began 1.32 seconds early, subtitles remained, and a large roof mark appeared.

This regression ended prompt-wording repair for that contract. Version 0.6 adds a provider-neutral constraint budget and blocks the single-pass shot because it combines three temporal stages, delayed exact dialogue, strict surface control, and identity-critical performance. The evidence supports a split/reference route decision; it does not establish a provider product limit or a universal score.

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
