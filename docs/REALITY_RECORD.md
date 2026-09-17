# Reality Record Contract

A Reality Record is the portable boundary between observed execution and independently checkable claims.

The contract is intentionally small enough to serialize, hash, replay, and inspect without requiring a live RChain node.

```ts
interface RealityRecord {
  version: "0.1";
  recordId: string;
  subject: {
    scenario: string;
    actor: string | null;
  };
  source: {
    adapter: string;
    environment: string;
  };
  observations: Observation[];
  claims: Claim[];
  evidence: Evidence[];
  dependencies: Dependency[];
  transformations: Transformation[];
  verification: Verification[];
  replay: Replay | null;
  integrity: {
    payloadHash: string;
    previousHash: string | null;
    recordHash: string;
  };
}
```

The exact runtime TypeScript model may evolve, but the semantic contract is stable:

- An observation says what a source reported.
- A claim says what the system is asserting from those observations.
- Evidence identifies the fields supporting a claim.
- A dependency records causal or state relationships.
- A transformation records a deterministic conversion between representations.
- Verification records predicates and their results.
- Replay records whether an executable result was reproduced.
- Integrity binds the record to its payload and predecessor.

## Why separate observations from claims?

A network can report something that cannot be established from the available evidence. The model therefore must not collapse `observed` into `verified`.

For example:

```text
OBSERVATION
node-C reports block hash H2

CLAIM
node-C agrees with the reference block

EVIDENCE
node-A: H1
node-B: H1
node-C: H2

VERIFICATION
FAIL — conflicting hash at the same height
```

The failed verification remains a useful Reality Record because it contains a concrete witness of divergence.

## Determinism

Canonical serialization, stable ordering, and explicit hashing are required before records are treated as portable evidence. Identical inputs must produce identical payload and record hashes.

## Adapter boundary

The record contract does not know whether evidence came from:

- a synthetic fixture;
- a local RChain node;
- a testnet node;
- multiple independent observers; or
- a future formal verification backend.

Adapters provide observations. The verification plane decides what those observations establish.

## Status semantics

`VERIFIED` is not synonymous with consensus finality or protocol correctness. It means the configured predicates passed over the supplied evidence.

`DIVERGENT` means a reproducible comparison found a conflict.

`INCOMPLETE` means the evidence set is insufficient for the requested claim.

This distinction is a core safety property of the project.
