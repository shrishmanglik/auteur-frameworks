# Spoken A-roll and post-production

AUTEUR separates two responsibilities that should not compete inside one provider prompt.

| Layer | Owns | Must not pretend to own |
| --- | --- | --- |
| Source generation | identity, spoken performance, lip sync, set, camera, wardrobe, clean terminal state | typography, final editorial rhythm, colour matching across takes, delivery mastering |
| Deterministic post-production | source selection, phrase-safe trims, assembly, overlays, B-roll, colour, audio mastering, export and QC | repairing a material identity, dialogue, or lip-sync failure by hiding it |

This boundary comes from a production case in which accepted source clips became a coherent application video through external editing. A later, faster edit passed author automation but failed founder playback. The lesson is not that automation failed. The automation answered file-integrity questions while the decision required a craft and audience judgment.

## Plan spoken clips by audible duration

The host declares the provider durations it has actually verified. AUTEUR counts audible words, estimates speech time from the declared pace, adds lead-in, timing tolerance and terminal settle, then chooses the smallest supported container that fits.

```bash
auteur-frameworks plan-spoken examples/spoken-clip-plan.json
```

The compiler:

- contains the approved script exactly once;
- permits one performance cue;
- asks for connected sentence-level phrasing;
- avoids invented phoneme confidence, seed locks or provider timing controls;
- treats its duration calculation as a planning estimate, not proof of returned timing.

A six-second thought should not be stretched into an eight or ten-second clip merely because the provider offers those options. If none of the caller-declared durations fits, the planner fails instead of inventing a capability.

## Lock sources by content, not filenames

Each source clip carries:

- a stable source ID;
- SHA-256;
- approved script;
- observed transcript;
- identity, lip-sync, dialogue and terminal observations;
- an explicit disposition: accepted, salvage, regenerate or manual review.

Filename order is not source identity. Source mapping survives duplicate download names and changing sort order because the edit plan joins on transcript, hash and source ID.

Exact dialogue and material identity or lip-sync failures regenerate. A clean phrase gap, tail, terminal settle or measured mix miss may be salvageable, but the derivative must be re-audited.

## Build the edit as a semantic sequence

Every cut should land at a verified phrase boundary. Every overlay is a meaning unit, not a karaoke transcript. Every B-roll shot and transition names its narrative purpose. Motion without a semantic job is decoration and can reduce comprehension even when it looks energetic.

Short two or three-second B-roll shots can create pace when the spoken idea changes that quickly. They are not a universal duration rule. Hold longer when the viewer needs time to read a diagram or understand a causal sequence.

B-roll may:

- externalize an abstract system or comparison;
- prove a claim with a receipted interface, artifact or measurement;
- create a visual reset at a real narrative turn;
- compress setup that would be tedious in A-roll;
- carry a transition motivated by shape, motion, colour or meaning.

B-roll must not conceal a material source failure. If the speaker says the wrong words, visibly loses identity or has unacceptable lip sync, regenerate the source.

## Treat overlays as rendered pixels

Text layout must be inspected at output resolution. Contact sheets and timeline previews can hide a clipped last word, unsafe mobile crop or edge collision. The plan requires both safe-area status and rendered-pixel review for every overlay.

Use selective phrases. One to six words is often enough, but the meaning unit controls the choice. Keep the speaker's face and existing brand marks clear. Enter and exit on the spoken concept, not on every word.

## Master picture and sound after assembly

The reference plan uses a strict zero-start timeline, declared frame rate, full decode, colour reference, 48 kHz stereo and measured loudness and peak targets. Those values are delivery intent until the exported file is measured.

The default example targets about -16 LUFS integrated and no more than -1 dBTP. A project may declare another platform or broadcaster target. AUTEUR checks the declared target rather than claiming one number is universal.

An output enlarged from 1080p to 4K is a `presentation-upscale`. It is not native 4K detail. Compare the upscale with the approved master and preserve the accepted audio stream identity.

## Keep three verdicts separate

`audit-edit` reports deterministic integrity and a release decision:

```bash
auteur-frameworks audit-edit examples/post-production-plan.json
```

Release requires all three:

1. author deterministic proof;
2. independent craft review from a different session;
3. founder or accountable audience acceptance.

Machine integrity does not approve rhythm, persuasion or taste. Founder rejection remains `REVISE` even when every decode, clock, loudness and hash gate passes.

## Inspection contract

Before acceptance:

- decode the complete picture and audio streams;
- inspect at least one frame per second;
- inspect every cut, overlay entry and exit, B-roll boundary and transition boundary;
- watch the whole piece at full speed with sound;
- compare the final delivery with the approved master;
- route the frozen result to a different reviewer.

The full-speed playback is not redundant with frame inspection. It answers whether the edit flows as human communication.

## Failure patterns retained as evidence

- A script repeated across prompt fields can become repeated speech. Keep it once.
- Too many performance instructions can compete. Keep one cue.
- Continuous cadence without sentence structure can flatten a paragraph into one long line. Preserve thought boundaries.
- Captions generated inside source footage are difficult to correct. Add them externally.
- A technically valid high-motion edit can still feel chaotic. Motion needs narrative purpose.
- A presentation upscale can look cleaner on a 4K canvas, but it cannot restore detail that never existed.

See the sanitized [case-study receipt](evidence/bwz-production-distillation-2026-08-06.json) for the evidence boundary behind these rules.
