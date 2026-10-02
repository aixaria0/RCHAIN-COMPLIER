# RCHAIN-COMPLIER — Assurance Engine

Reusable infrastructure for task-bound evidence, independent process identities, durable recovery and deterministic verification. A claim receives **PASS**, **BLOCKED** or **FAIL** only from executable checks against reviewer-supplied trust pins.

RChain is our first serious external integration and adversarial workload. Its C192/C171 witnesses, disposable patches, devnets and campaign artifacts stay in integration workflows; they do not define the core protocol.

## Run it

Node.js **22.18+**, Linux:

```sh
npm ci
npm run demo
npm run pack:assurance
npm run verify:assurance-package
```

The demo starts three real processes, signs and persists a task and evidence, obtains two independent verifier receipts, verifies a canonical package, restarts without duplicating work, rejects deterministic tampering and refutes a false claim. Evidence remains in `artifacts/assurance-demo`. Use a fresh output directory for another demo: `npm run assurance -- demo /tmp/assurance-demo-2`.

Install the generated `dist/aixaria-assurance-engine-0.3.0.tgz` in a separate project. The tarball provides typed ESM APIs and the `assurance` CLI, with **zero runtime npm dependencies**. Existing dashboard and research commands remain available in this repository.

## Product surface

| Capability | Interface |
| --- | --- |
| Submit a bounded JSON workload | `AssuranceEngine.run(workload)` / `assurance run` |
| Restart/rejoin persisted identities | `recover()` / close and reopen the workspace |
| Export provenance-bound signed evidence | `exportEvidence()` / `.evidence.ndjson` |
| Independently verify pins, signatures and replay | `verifyEvidence()` / `assurance verify` |
| Monitor bounded journals and causal blockers | `assurance status`, structured diagnostics, loopback health/event APIs |
| Add an integration without changing the event protocol | Trusted versioned verifier registry; explicit RChain subpath |

[Install, SDK, CLI and operator guide](docs/ASSURANCE_ENGINE.md) · [Architecture](docs/ASSURANCE_ARCHITECTURE.md) · [Audit and gaps](docs/ASSURANCE_PRODUCT_AUDIT.md) · [Compatibility and release policy](docs/ASSURANCE_VERSIONING.md) · [Security](SECURITY.md)

## Evidence boundary

PASS means the selected task-bound claim was reproduced by two non-submitter identities using the reviewer's registered deterministic verifier. These are separate local processes, not separate organizations. Untrusted packages cannot choose their reviewer policy, task, claim or verifier code. Retain reviewer pins separately; pins downloaded from the same untrusted producer do not establish trust.

This is bounded local infrastructure: fixed membership, private local keys, loopback transport and trusted verifier code. It does not claim universal execution safety, remote multitenant isolation, network completeness, production RChain finality or maximum-throughput performance. The C192 adapter validates a pinned witness declaration; upstream execution remains evidenced by its dedicated workflows and artifacts.

## Source development

```sh
npm run typecheck:assurance
npm run format:assurance
npm run lint:assurance
npm run test:assurance
npm run test:lattice
npm run check:lattice-vectors
```

Product CI additionally builds/packages, installs offline in a clean consumer and checks compiled lifecycle/recovery/tamper behavior on Node 22 and 24. Existing UI/compiler/RChain CI gates remain in place. No evidence history or research workflow was removed.

Deeper historical material: [research overview](docs/RESEARCH_OVERVIEW.md), [lattice protocol](docs/INTELLIGENCE_LATTICE_EVENT_CORE.md), [C192 live witness](docs/RCHAIN_C192_LIVE_WITNESS.md), [paired evaluator](docs/RCHAIN_C192_C171_PAIRED_EVALUATOR.md), [repeated devnet campaign](docs/RCHAIN_C192_REPEATED_CAMPAIGN.md).

The original proprietary [LICENSE](LICENSE) remains unchanged; public source availability and a buildable tarball do not grant redistribution permissions.
