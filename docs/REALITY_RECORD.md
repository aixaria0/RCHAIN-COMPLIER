# Reality Record Contract

A `RealityRecord` is the portable boundary between observed execution and independently checkable claims.

The runtime implementation lives in:

- `src/lib/compiler/reality-record.ts` — schema, state derivation, sealing and integrity verification.
- `src/lib/compiler/reality-record-adapter.ts` — adapter from the existing `compile()` result into the portable record.
- `src/lib/compiler/reality-record-adapter.test.ts` — end-to-end contract tests.

The adapter does not create a second execution engine. It preserves the existing compiler result and projects it into a provider-neutral evidence artifact.

## Runtime shape

```ts
interface RealityRecord {
  schema: "rchain-reality-record/v1";
  id: string;
  subject: {
    id: string;
    kind: string;
    label?: string;
  };
  source: string;
  observations: RealityObservation[];
  claims: RealityClaim[];
  evidence: RealityEvidence[];
  dependencies: RealityDependency[];
  transformations: RealityTransformation[];
  verification: RealityVerification[];
  replay: RealityReplay;
  state: RealityState;
  integrity: {
    recordDigest: string;
    previousDigest?: string;
    algorithm: "SHA-256";
  };
}
```

## Evidence lifecycle

The current synthetic compiler path is:

```text
QuantumOS event
  → QLF certificate
  → Rholang process
  → deterministic execution trace
  → block proposal
  → Sentinel-style observations
  → cross-node / Casper / Lattice analysis
  → verification checks
  → replay
  → Reality Record
```

Every stage remains inspectable. The Reality Record is the portable boundary after compilation, not a replacement for the underlying network or execution layers.

## Why separate observations from claims?

A source can report something that the available evidence does not establish. The model therefore keeps observation, claim, evidence and verification separate.

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

A failed verification is still useful evidence because the record preserves the concrete divergence witness instead of hiding it behind a boolean result.

## Determinism and integrity

`sealRealityRecord()` derives the state, canonicalizes the record payload, and binds it with SHA-256. `verifyRealityRecordIntegrity()` recomputes the digest from the sealed payload.

The optional `previousDigest` field lets records form a deterministic evidence chain without changing the record's identity or payload semantics.

## State semantics

The runtime state vocabulary is:

```text
OBSERVED
CONSISTENT
REPRODUCED
VERIFIED
DIVERGENT
INCOMPLETE
```

`VERIFIED` means the configured verification predicates passed over the supplied evidence. It does not mean protocol-wide consensus finality or a proof of RChain correctness.

`REPRODUCED` means replay matched the expected execution result.

`DIVERGENT` means a recorded verification or replay comparison found a conflict.

`INCOMPLETE` means the requested verification or replay does not have enough evidence to complete.

`OBSERVED` is the minimum state when there is recorded observation but no verification result. `CONSISTENT` captures verification results that are mutually consistent without all predicates being elevated to `VERIFIED`.

## Adapter boundary

The record contract does not require evidence to come from one specific source. The existing synthetic fixture is the first provider, while future observation adapters can supply:

- a local RChain node;
- a testnet node;
- multiple independent observers such as `rchain-sentinel`; or
- a future formal verification backend.

Adapters provide observations. The verification plane determines what those observations establish.

## Public entry point

```ts
const record = compileRealityRecord("exchange-commit", "none");
```

The resulting artifact is a portable, hash-bound representation of the existing compiler result and can be inspected without a live RChain node.
