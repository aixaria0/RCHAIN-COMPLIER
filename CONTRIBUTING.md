# Contributing

RChain Reality Compiler is a research-oriented engineering project. Contributions should make the verification model clearer, more reproducible, or easier to inspect.

## Principles

- Prefer small, reviewable changes.
- Keep deterministic logic independent from the UI.
- Add tests for semantic or verification changes.
- Document protocol assumptions and external dependencies.
- Never commit credentials, tokens, private keys, local databases, or generated deployment output.
- Preserve the distinction between synthetic fixtures and live network evidence.

## Pull requests

A useful pull request explains:

1. What changed.
2. Why the change is needed.
3. Which invariant or boundary it affects.
4. How it was tested.
5. Whether it changes any externally visible behavior.

Run the full local quality gate before requesting review:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
