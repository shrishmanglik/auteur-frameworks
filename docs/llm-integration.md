# LLM and Agent Integration

AUTEUR Frameworks separates creative development from provider execution. Any model that can return JSON matching a supplied schema can participate.

## Contract flow

1. Build a `DevelopmentRequest`.
2. Call `buildDevelopmentContract` or `auteur-frameworks develop`.
3. Send `systemInstruction`, `userBrief`, and `responseSchema` to your model.
4. Parse the response with `parseUniversalPacket`.
5. Run `preflightPacket`.
6. Compile storyboards and prompt packages only after blocking issues are resolved.

## Shell-capable coding agents

Codex, Claude Code, Gemini CLI, and other shell-capable tools can use the CLI directly:

```text
Install github:shrishmanglik/auteur-frameworks#main in the current Node project.
Read docs/quickstart.md from the installed package.
Create a DevelopmentRequest JSON for the user's production brief.
Run auteur-frameworks develop on that request.
Return only a Universal Packet matching responseSchema.
Run validate and preflight. Correct blocking errors before compiling.
Do not invent provider limits, pricing, audio support, or API behavior.
```

The host agent should treat command output as data. A non-zero CLI exit code is a blocking integration failure.

## Model API integration

```ts
import {
  buildDevelopmentContract,
  compilePacket,
  parseUniversalPacket,
  preflightPacket,
} from "auteur-frameworks";

const contract = buildDevelopmentContract(request);

const raw = await yourStructuredOutputClient.generate({
  system: contract.systemInstruction,
  user: contract.userBrief,
  schema: contract.responseSchema,
});

const packet = parseUniversalPacket(raw);
const report = preflightPacket(packet);
if (!report.passed) {
  return { status: "needs-revision", issues: report.issues };
}

return { status: "ready", packet, promptPackage: compilePacket(packet) };
```

`yourStructuredOutputClient` is intentionally pseudocode. Provider SDKs, credentials, retries, spend gates, and model routing belong in the host application.

## Local models

For local models, use the same contract and schema. If the model cannot reliably return the full packet:

1. develop story and scenes first;
2. generate shots one scene at a time;
3. merge into one packet;
4. validate the merged packet;
5. run pre-flight before compilation.

Do not silently truncate the schema or omit continuity fields to fit a context window. Reduce the production slice instead.

## MCP tools

An MCP server can expose the public functions as deterministic tools:

- `develop_production`
- `validate_packet`
- `preflight_packet`
- `build_storyboard`
- `compile_prompt_package`
- `build_repair_prompt`

Keep model calls outside these tools unless the server explicitly declares provider, credential, and spend behavior.

## Required host safeguards

- validate untrusted model output;
- preserve the original brief and packet revision;
- show pre-flight errors with their corrective action;
- separate provider-observed capabilities from assumptions;
- confirm credit-spending dispatches;
- never persist provider credentials in prompt packets;
- record which packet version produced each render.
