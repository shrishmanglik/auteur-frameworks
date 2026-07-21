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

Provider smoke tests are separate from deterministic package tests. They must record the account boundary, provider/model label, visible cost, duration/aspect settings, submitted shot, result, and limitations of the evidence. One provider result cannot prove universal model performance.
