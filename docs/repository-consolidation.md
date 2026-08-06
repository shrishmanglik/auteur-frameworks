# Repository consolidation

`auteur-frameworks` is the canonical public AUTEUR repository. It owns provider-neutral contracts, schemas, compilers, CLI and MCP surfaces, synthetic fixtures, tests, documentation and installable skills.

The earlier `auteur-os` repository is an application prototype and research surface. Its complete history is not merged into the framework because that would mix UI, local persistence, media and private research-derived data with the public deterministic core.

## Transfer and retirement matrix

| Earlier repository capability | Classification | Canonical destination or decision |
| --- | --- | --- |
| Universal packet and intake | `ALREADY_IN_CANON` | `src/schemas.ts`, development contracts and generated schemas |
| Provider-neutral production flow | `ALREADY_IN_CANON` | compiler, storyboard, production kit, route advice, QC and repair modules |
| Optics and cinematography data | `ALREADY_IN_CANON` | typed capture and optics contracts |
| Agent callable tools | `ALREADY_IN_CANON` | dependency-free MCP server plus CLI parity |
| Spoken A-roll timing and returned-media decisions | `TRANSFERRED` | spoken clip planner, A-roll post-flight and post-production audit |
| External editorial workflow | `TRANSFERRED` | post-production schema, CLI, MCP, docs, fixture, tests and skill |
| Web UI and desktop shell | `APP_ONLY` | not part of provider-neutral core; preserved in archived history |
| Local state vault and persistence layer | `APP_ONLY` | host application responsibility, not core framework state |
| Provider model router | `APP_ONLY` | provider capability belongs to the host and remains unknown in core |
| Private prompt and render brains | `PRIVATE_RESEARCH_EXCLUDED` | generalized methods only; no raw corpus, prompts, mappings or media |
| Generated media and visual assets | `PRIVATE_RESEARCH_EXCLUDED` | no binary media in the public package |
| Conflicting proprietary README language | `RETIRED` | canonical repository uses the verified Apache-2.0 license |

No listed must-preserve capability remains unclassified. Archiving the earlier repository is reversible and does not delete its history. The archive is complete only after GitHub provider readback confirms the archived state and the migration notice points to the merged canonical commit.

## Why this is one framework without one raw history

Repository consolidation means one current source of truth, not concatenating every old file. The canonical package now contains the reusable capabilities. Application-only and private research surfaces remain historical evidence, not competing canon.
