# Provider Handoff

The core package is provider-neutral. This guide describes a safe manual handoff pattern, not a claim about any provider's current product limits.

## Before submission

1. Run `validate` and `preflight`.
2. Build `kit` and inspect each shot's route advice.
3. Choose one shot, not an entire sequence, unless the provider workflow explicitly supports sequences.
4. Confirm duration and aspect ratio in the provider interface.
5. Attach required identity, object, opening-state, terminal-state, or final-frame references only through supported controls.
6. Preserve the packet version and shot ID in your own job ledger.

## Prompt surfaces

- **videoPrompt**: the canonical framework-native architecture, including its required ordering and production blocks.
- **compactVideoPrompt**: a whitespace-flattened, budgeted attempt for provider fields that handle long rich-text input poorly; its report states whether the selected framework architecture survived intact.
- **framePrompt**: a reference-frame or image-generation description without temporal choreography.
- **audioPrompt**: spoken performance, sound design, and music boundary when present.
- **negativePrompt**: exclusions for systems or adapters that expose a separate negative field.

The `videoPrompt` already contains exclusions. Do not append the same negative list twice.

`compactVideoPrompt` uses a toolkit-owned 4,000-character ceiling; this is not a provider limit. Inspect `compactPromptReport` before dispatch. `frameworkPreserved` must be true, and high-stakes generation requires empty `omittedExclusions` and `truncatedSections`. Otherwise use the full prompt, reduce the shot safely, or pass omitted safeguards through a supported separate negative field.

## Manual Flow-style smoke

For a single-shot video workflow:

1. set the configured duration to the shot's `durationSeconds` when available;
2. set the packet's aspect ratio;
3. paste `videoPrompt`; use `compactVideoPrompt` only when the provider field needs it and the compact report proves that no required section or safeguard was lost;
4. submit one variation first;
5. evaluate action completion, geometry, physical behavior, identity, audio, and final state;
6. use `buildRepairPrompt` for one observed defect at a time.

## Sequential extension

Do not compile an extension from the planned shot alone. First inspect the actual final frame of the accepted render, then encode that evidence in a continuation contract:

```bash
npx auteur-frameworks continue examples/continuation.json --out continuation-prompt.json
```

The compiler front-loads a frame-zero match instruction and a single-camera-path guard. These attempt to preserve the accepted boundary and require every later composition to be reached through visible camera motion rather than a hidden coverage cut. They are instructions, not provider guarantees: the tested Flow extension restaged frame zero in one cycle even though later motion continuity improved. Inspect every returned boundary before accepting or extending it again.

When speech is required, attach a `dialogueCue` with a time window, speaker, delivery, and mix priority. The compiler quotes the line exactly once and forbids paraphrase, repetition, substitution, and generated subtitles. Verify intelligibility from the returned audio; stream presence alone is not dialogue proof.

The contract requires:

- the exact observed final frame and preserved visible state;
- one irreversible motion that begins inside the first two seconds;
- the source geometry, transition mechanism, destination geometry, and physical camera path;
- physics invariants and a new final-frame handoff.

Submit only `prompt` from the compiled result through the provider's supported extension control. If the provider repeats the boundary, cuts, dissolves, teleports, or morphs into the destination, record `CONTINUATION_BRIDGE_BREAK` and repair the first motion or spatial bridge without redesigning the later shot.

Provider models, controls, costs, and capabilities change. Treat the interface shown at runtime as provider evidence for that session, not as a permanent compiler rule.

Text-only mode is not the default for every shot. The route advisor marks causal contact and precise assembly for first/last-frame workflows, exact fluid counts for split passes, and identity or blank-surface control for reference-first workflows. If the selected provider cannot support that route, keep capability `UNKNOWN`, warn the user, and do not silently claim the prompt can enforce it.

## Result review

Record:

- packet version and shot ID;
- provider and model label shown at submission;
- configured duration and aspect ratio;
- reference assets attached;
- observed completion state;
- continuity defects;
- physics/material defects;
- audio/sync defects;
- repair decision.

Never place credentials, account identifiers, private source paths, or customer media inside the Universal Packet.
