# AUTEUR Frameworks

Open, provider-neutral production frameworks for developing an idea into a structured story, shot plan, storyboard contract, generation prompt package, pre-flight report, and constrained repair prompt.

This repository is the reusable intelligence layer behind AUTEUR's content-creation research. It is software, not a prompt dump.

## What ships

- A typed Universal Packet for stories, scenes, shots, optics, lighting, physics, continuity, audio, and exclusions.
- Nine composable frameworks for cinematic prose, act/shot planning, temporal evolution, social sequences, practical stunts, continuous takes, audio, and repair.
- A deterministic compiler that emits video, frame, audio, and negative prompts.
- Storyboard panel projection with camera, action, duration, continuity, and frame-generation contracts.
- Local pre-flight QC for timing, continuity, audio, typography, and realism anchors.
- A repair engine for recurring failure classes such as static motion, typography corruption, identity drift, topology drift, object loss, and broken physics.
- A command-line interface and TypeScript API.
- A schema-bound development contract that lets any compatible LLM turn a raw brief into the Universal Packet without inventing provider capabilities.

## Evidence boundary

The methodology was developed from 1.5 years of private prompt-and-render research and validated against **6,069 rendered outputs from a 6,086-record corpus; 17 source records lacked a corresponding render file and were excluded**.

The private prompt corpus, rendered media, per-output observations, internal identifiers, and prompt-to-output mappings are not included. This repository contains generalized frameworks, original source code, synthetic examples, and aggregate methodology only. See [Research Boundary](docs/research-boundary.md).

## Install

~~~bash
npm install
npm run check
~~~

Package publication is not part of the first GitHub release. Consumers can install from Git while the public API stabilizes.

## TypeScript

~~~ts
import {
  buildDevelopmentContract,
  buildStoryboard,
  compilePacket,
  preflightPacket,
  parseUniversalPacket,
} from "auteur-frameworks";

const development = buildDevelopmentContract({
  idea: "A night-shift cleaner finds an elevator stopping at a floor that does not exist.",
  format: "short-film",
  targetDurationSeconds: 90,
  aspectRatio: "2.39:1",
  audience: "adult suspense viewers",
  tone: ["dry", "uneasy", "human"],
  constraints: ["one actor", "one location"],
  hasDialogue: true,
  audioRequired: true,
});

// Send development.systemInstruction, development.userBrief, and
// development.responseSchema to the model or orchestration layer you control.

const packet = parseUniversalPacket(yourStructuredProduction);
const preflight = preflightPacket(packet);

if (!preflight.passed) console.error(preflight.issues);
else console.log({ promptPackage: compilePacket(packet), storyboard: buildStoryboard(packet) });
~~~

## CLI

~~~bash
npm run build
node dist/cli.js validate examples/product-film.json
node dist/cli.js preflight examples/product-film.json
node dist/cli.js storyboard examples/product-film.json --out storyboard.json
node dist/cli.js compile examples/product-film.json --out prompt-package.json
~~~

## Production flow

~~~mermaid
flowchart LR
    A["Idea or brief"] --> B["Universal Packet"]
    B --> C["Story and scene structure"]
    C --> D["Shot contracts"]
    D --> E["Storyboard panels"]
    D --> F["Prompt package compiler"]
    E --> G["Pre-flight QC"]
    F --> G
    G -->|"Pass"| H["Provider handoff"]
    G -->|"Observed defect"| I["Constrained repair prompt"]
    I --> G
~~~

## Framework selection

| Framework | Use it when |
| --- | --- |
| Cinematic Prose Stack | One premium, physically specific shot needs full craft coverage |
| Act and Shot Master Spec | A sequence needs escalation, payoff, and continuity |
| JSON Scene Contract | Another tool must parse, validate, or version the production |
| Temporal Evolution | Transformation or VFX continuity is the hard problem |
| Timed Social Sequence | A short-form hook and reveal must land inside strict timing |
| Practical Stunt Contract | Mass, contact, momentum, and camera choreography matter |
| Continuous Take | One unbroken action needs stable identity and a clear action arc |
| Constrained Repair Pass | A known defect must be fixed without redesigning the shot |
| Audio Contract | Dialogue, sound, and sync need an explicit production surface |

## Design rules

1. Provider-neutral by default. Provider limits remain unknown until documented evidence exists.
2. Structured data is the source; prose prompts are compiled artifacts.
3. Every shot declares physical reality, temporal change, continuity, and exclusions.
4. Text is treated as a post-production handoff unless a verified workflow supports it.
5. QC findings produce an action, not a generic quality score.
6. Repairs target one defect and preserve the original shot identity.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). New frameworks require a clear production problem, typed contract, deterministic tests, falsifiable QC rule, publication-safe evidence classification, and no raw prompts or media.

## Status

Version 0.1.0 is the framework-first public bootstrap. Provider adapters and commercial API execution are intentionally out of scope.

## License

Apache-2.0. See [LICENSE](LICENSE).
