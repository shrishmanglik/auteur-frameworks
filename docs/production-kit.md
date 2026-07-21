# Complete Production Kit

`buildProductionKit(packet)` and `auteur-frameworks kit packet.json` compile the full deterministic handoff from one Universal Packet. This is the default integration surface when a host wants more than prompt strings.

## Contents

- creative brief and story spine;
- scene plan, character bible, and world bible;
- style, palette, material, and imperfection bible;
- ordered visual storyboard and shot list;
- optics, camera, lighting, timing, physics, and continuity contracts;
- sound plan with canonical spoken text, sound design, and music boundaries;
- reference-asset manifest and per-shot route advice;
- full and compact video prompts, frame prompts, audio prompts, and exclusions;
- structural pre-flight, repair catalog, and export manifest.

## Route advice

The route advisor does not pretend that a longer text prompt can solve every provider failure. It marks high-risk work and selects one of four workflow shapes:

| Mode | Use |
| --- | --- |
| `text-only` | One readable action with low reference dependency |
| `reference-first` | Identity, product design, brand control, or transformation geometry |
| `first-last-frame` | Causal contact or exact mechanical assembly with measurable endpoints |
| `split-pass` | Numerically exact fluid events or other actions that should be isolated and verified separately |

Every recommendation ships with required assets and acceptance checks. The field `providerCapabilityStatus` remains `UNKNOWN`; the host must verify that its chosen provider supports the recommended reference workflow.

Use shot-level `generationRisks` for explicit route requirements. The advisor applies only narrow contextual inference when structured markers are absent; common nouns such as "plate", "seat", or "contact lens" do not create workflow requirements.

Character ownership is explicit through shot-level `characterIds`. If a production has a cast but a shot does not declare character ownership, the kit preserves `characterRelationshipStatus: "UNKNOWN"` and pre-flight emits a warning. It never assigns cast from substring guesses.

## Host contract

1. Ask an LLM to produce a Universal Packet with `develop`.
2. Validate the returned packet.
3. Build the production kit.
4. Resolve every blocking pre-flight issue.
5. Attach every required high-risk asset.
6. Dispatch one shot or continuation at a time.
7. Inspect the returned asset against route acceptance checks.
8. Score and repair observed failures without redesigning accepted craft.

The production kit is complete production intent, not a provider-success certificate. Returned pixels and audio remain the acceptance evidence.
