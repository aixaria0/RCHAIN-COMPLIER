# Assurance architecture

The product wraps the developed compiler/event/journal architecture. It does not introduce an RChain fork or replace the existing dashboard.

| Layer | Source | Responsibility |
| --- | --- | --- |
| Product interface | `src/lib/assurance` | Versioned workload submission, supervisor lifecycle, evidence export, reviewer pins, status taxonomy and CLI |
| Assurance protocol | `src/lib/lattice/protocol.ts`, `canonical.ts` | Bounded JSON, Ed25519 identities, fixed admission policy, direct-parent binding, task/claim/evidence/receipt events |
| Durability and transport | `src/lib/lattice/journal.ts`, `node.ts` | SQLite/WAL atomic batches, corruption checks, bounded loopback pages, exchange deadlines and worker processing |
| Independent replay | `src/lib/lattice/replay.ts`, `verification.ts` | Causal readiness, equivocation quarantine, task provenance, registered deterministic reproduction, distinct identity certificates |
| Verification compiler | Existing `src/lib/compiler` | Typed bounded verification problems, artifacts, witness semantics and repair/provenance machinery |
| Integrations | `src/lib/integrations/rchain-c192.ts`, existing `src/lib/cbc`, `src/lib/subjects`, RChain examples/tools/workflows | External witness semantics, adapters, disposable upstream wiring and adversarial workloads |
| Optional application | Existing React/dashboard/server | Inspect evidence and research; not required by the Node tarball |

The supervisor owns the submitter signing key and signs a four-event task/claim/evidence/request batch into the existing owner journal. Its owner child only replicates events. Two separate worker children have different keys and membership restricted to capabilities/verification receipts; each pulls the batch, performs its registered calculation and returns a signed receipt. A local SQLite lock prevents a second product supervisor from using the same workspace. No event data selects executable code.

Replaying the complete signed set computes causal readiness and semantic verification independently of arrival order or timestamps. The product assessor then checks the explicitly selected task/claim and relevant causal evidence. A canonical manifest plus sorted events carries the audit snapshot. Reviewer-supplied policy/task/claim pins and optional exact package digest define what is being evaluated. Recorded status fields are never a substitute for reproduction.

`VerifierRegistry` is the reusable integration contract. It maps a versioned operation to a deterministic bounded function returning verdict/artifact. Workers, export/replay and independent review all receive the registry explicitly. The legacy lattice default still includes the original C192 adapter for backward compatibility; the product default advertises only its core arithmetic operation. The RChain-specific verifier implementation now lives in `integrations`, preserving its exact existing witness semantics. A future registry-only lattice default requires a separate compatibility change, not silent removal of the existing RChain operation.

RChain's evidence progression remains outside the core: pinned upstream witness, deterministic candidate model, Rust gate, disposable production-path wiring, controlled devnet, repeated campaign, independently retained artifacts. Each gate only supports its own bounded claim. Another integration can follow the same gates and export the same generic task/evidence/receipt package without importing RChain constants into its lifecycle.

The entry-file implementation digest in capability events and custom module pin are useful drift diagnostics. Neither is a full build provenance attestation. Event roots do not hash verifier dependencies. Use trusted release artifacts and the repository's separate build/replay provenance contracts when that stronger assurance is needed.
