# Quickstart

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Install from GitHub

```bash
mkdir auteur-quickstart
cd auteur-quickstart
npm init -y
npm install github:shrishmanglik/auteur-frameworks#main
npx auteur-frameworks help
```

The Git dependency builds itself during installation. No global package install is required.

## Compile a known-good production

```bash
npx auteur-frameworks preflight \
  node_modules/auteur-frameworks/examples/product-film.json

npx auteur-frameworks compile \
  node_modules/auteur-frameworks/examples/product-film.json \
  --out prompt-package.json
```

Open `prompt-package.json`. Each shot contains:

- `videoPrompt`
- `framePrompt`
- `audioPrompt`
- `negativePrompt`
- `qcIssues`

## Develop a new production

Copy one request from `node_modules/auteur-frameworks/examples/requests/` and edit the idea, format, duration, aspect ratio, audience, tone, constraints, creative mandate, must-include details, and clichés to avoid.

```bash
npx auteur-frameworks develop request.json --out development-contract.json
```

Send the contract's `systemInstruction`, `userBrief`, and `responseSchema` to a structured-output model. Save its JSON response as `production.json`.

```bash
npx auteur-frameworks validate production.json
npx auteur-frameworks preflight production.json
npx auteur-frameworks storyboard production.json --out storyboard.json
npx auteur-frameworks compile production.json --out prompt-package.json
```

Do not skip pre-flight. A successful schema parse proves shape; pre-flight checks relationships, timing, production duration, continuity, audio, and known generation risks.

## Use from TypeScript

```ts
import { compilePacket, parseUniversalPacket, preflightPacket } from "auteur-frameworks";

const packet = parseUniversalPacket(input);
const report = preflightPacket(packet);
if (!report.passed) throw new Error(JSON.stringify(report.issues));
const compiled = compilePacket(packet);
```

## Next

- [LLM integration](llm-integration.md)
- [Provider handoff](provider-handoff.md)
- [Evaluation methodology](evaluation.md)
