# Architecture

## Source of truth

The Universal Packet is the production source of truth. Storyboards and prompts are projections, not parallel documents.

## Layers

1. **Schema** validates production intent, story, scenes, shots, optics, physics, continuity, audio, and exclusions.
2. **Framework registry** selects the structural contract appropriate to the creative problem.
3. **Production-kit projection** emits story, bibles, storyboard, shot list, sound, assets, prompts, QC, repairs, and export order from the packet.
4. **Framework-native compiler** dispatches to distinct prose, JSON, temporal, social, stunt, continuous-take, and audio architectures rather than relabeling one generic template.
5. **Route advisor** identifies workflows where text-only prompting is a poor control surface and requests references or split passes.
6. **Storyboard projection** creates ordered visual panels from the same shot records.
7. **Pre-flight QC** rejects structural errors and warns on recurring generation risks.
8. **Repair engine** converts an observed defect into a constrained correction while preserving shot identity.

## Provider boundary

The core does not fabricate provider limits, pricing, audio capability, duration windows, or API availability. Provider adapters can be added later as separate packages with field-level evidence.

## Stability

Schema version and package version are independent. Breaking schema changes require a new schema version and migration guidance.

See [Framework-Native Prompt Architectures](framework-architectures.md).
