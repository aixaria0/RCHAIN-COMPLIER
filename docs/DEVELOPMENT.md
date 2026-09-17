# Development Workflow

## Local setup

```bash
npm install
npm run dev
```

The application uses Vite for development and a server/runtime layer for server-side behavior.

## Before opening a change

Run the repository quality gates:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

For formatting:

```bash
npm run format
```

## Change discipline

Keep changes focused. A compiler/verification change should not silently modify UI behavior, authentication, or deployment integration.

When changing verification semantics:

- identify the affected invariant;
- add or update deterministic tests;
- document any new assumptions;
- preserve provenance in failure results;
- avoid relying on network state in unit tests.

When changing the UI:

- keep verification data and rendering logic separate;
- do not present synthetic evidence as live chain evidence;
- keep route-level code thin and reusable primitives in `src/components`.

## Suggested commit structure

Use conventional, descriptive commit subjects:

```text
feat: add replay divergence verifier
fix: preserve evidence hash across normalization
refactor: isolate compiler evidence types
test: cover contradictory execution claims
docs: clarify verification boundary
chore: update build tooling
```

## Architecture changes

For a change that affects a subsystem boundary, update `docs/ARCHITECTURE.md` in the same change. The repository should make its trust boundaries understandable without reading the entire implementation.
