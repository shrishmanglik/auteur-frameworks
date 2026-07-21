# Integration Guide

## Recommended flow

1. Collect an idea, format, audience, duration, aspect ratio, tone, and constraints.
2. Build a Universal Packet.
3. Validate it with parseUniversalPacket.
4. Run preflightPacket.
5. Present errors as blocking production actions and warnings as explicit choices.
6. Build the full handoff with `buildProductionKit`.
7. Resolve its route advice and required reference assets per shot.
8. Attach provider-specific translation only after the provider capability is evidenced.
9. Dispatch and audit one result at a time.
10. Feed observed failures into `buildRepairPrompt`.

## UI mapping

- Story maps to logline, dramatic question, and beats.
- Scenes map to locations, purposes, and ordered shot IDs.
- Storyboard cards map one-to-one with shot records.
- Inspector controls edit optics, lighting, continuity, timing, and audio.
- Prompt Package is read-only output unless the application deliberately forks a new packet version.
- Review presents pre-flight issues and repair prompts.
- Export presents the complete production kit; individual views are projections of that same artifact.

## Persistence

Store the Universal Packet, not only compiled prompt strings. Recompile artifacts whenever the packet changes.
