# Security Policy

## Supported versions

Security fixes target the latest release and the default branch until a formal support matrix is published.

## Report privately

Do not open a public issue for:

- credentials, tokens, cookies, or provider session exposure;
- private corpus, prompt, media, identifier, or path leakage;
- arbitrary file read/write or command execution;
- package, dependency, or release-chain compromise;
- validation bypasses that allow untrusted model output to escape the declared schema;
- publication-boundary audit bypasses.

Use GitHub's **Report a vulnerability** security-advisory feature for this repository.

Include:

- affected version or commit;
- operating system and Node version;
- minimal reproduction steps;
- expected and observed behavior;
- impact;
- a minimal safe proof that does not contain real credentials or private creative work.

## Response

The maintainer will acknowledge a complete report, reproduce it, classify severity, and coordinate a fix and disclosure plan. Timelines depend on impact and reproducibility; no fixed response-time guarantee is claimed for this early open-source release.

## Security boundaries

AUTEUR Frameworks:

- does not store provider credentials;
- does not dispatch paid generation jobs;
- does not execute model-generated code;
- treats model output as untrusted until schema validation;
- scans source, generated output, and package contents for private-corpus and credential markers.

Host applications remain responsible for authentication, key storage, provider spend approval, sandboxing, persistence, network policy, and job provenance.
