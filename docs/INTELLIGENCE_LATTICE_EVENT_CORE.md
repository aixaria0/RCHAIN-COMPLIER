# Intelligence Lattice evidence event core v1

This Node-only integration slice reuses the compiler's SHA-256 artifact primitive,
`compileVerification` and assurance outcome mapping. Existing compiler/research
branches and browser behavior remain intact. It provides a signed event/evidence
boundary, deterministic knowledge projection and a two-process durable experiment.
It is the first implementation slice, not the complete Minimum Viable Lattice.

## Run and audit

Use Node 22 (including built-in experimental SQLite), Python 3 and OpenSSL.
No provider credentials, external models or additional runtime dependencies are needed.

```sh
npm ci
npm run typecheck:lattice
npm run lint:lattice
npm run test:lattice
npm run check:lattice-vectors
npm run demo:lattice -- /tmp/lattice-audit.json
npm run replay:lattice -- /tmp/lattice-audit.json
```

The experiment forks two independent OS processes with distinct Ed25519 identities,
SQLite journals and ports. A produces the correct sum, B a contradictory sum.
A challenges B, requests evidence and verification; B's deterministic worker emits
receipts. Both nodes independently reproduce receipts through the existing verifier
compiler. A records an explicit decision over a named evidence cut. An unsupported
hypothesis stays unresolved. Duplicate delivery is idempotent. A is killed with
SIGKILL after an acknowledged write; B records a new claim during the interruption.
A restarts from its existing key/journal and peers converge after exchange.
The exported audit contains public identities, policy, every signed event, derived
view and ten checked outcomes; temporary private keys are removed. A separate CLI
replays the export in reverse order and checks the recorded projection.

The workload is deliberately bounded arithmetic. Its participant actions are scripted;
it proves evidence/challenge/replay and crash recovery, not autonomous decomposition,
heterogeneous reasoning or the final collective-intelligence success criterion.

## Protocol and meaning

`schemas/intelligence-lattice-event-v1.json` and the policy schema describe exact
versioned fields. Runtime admission is authoritative: schema validation alone cannot
check cryptography, canonical bytes, references or evidence reproduction.

Canonical encoding is restricted JSON, UTF-8 without BOM: sorted ASCII object keys,
no whitespace, safe integers only (no floats or negative zero), scalar Unicode, plain
objects and dense arrays. Depth is at most 12; objects 64 keys; arrays 256 elements;
canonical event size 16 KiB. Accessors, cycles and unsupported values are rejected.
Wire parsing rejects alternate encodings and duplicate object keys. Arrays retain
order. Parents are sorted unique identifiers. The public golden vector is checked
in TypeScript and independently with Python/OpenSSL. Its disclosed test key must
never be enrolled in a real deployment.

Content hashes are SHA-256 of canonical bytes. Actor identifiers hash the domain
`intelligence-lattice-actor/v1`, NUL and raw Ed25519 public key. Policy digests hash
`intelligence-lattice-policy/v1`, NUL and canonical policy. Event identifiers and
signatures cover `intelligence-lattice-event/v1`, NUL and canonical unsigned envelope.
`id` and `signatureHex` are excluded from that unsigned envelope. Membership-policy
ordering is digest-significant; every participant needs the identical policy.
Signatures establish attributable integrity, not truth. `issuedAt` is the producer's
asserted clock, never a total order, freshness proof or confidence signal.

| Event                | Meaning                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| capability           | Signed advertisement; implementation hash identifies the entrypoint only, not a verified full build      |
| claim                | Assertion with subject, predicate, value, domain, assumptions, method, asserted confidence and falsifier |
| evidence             | Separately signed supporting/contradicting content with checked digest                                   |
| challenge            | Attributable objection; does not automatically invalidate a claim                                        |
| evidence_request     | Preserved request for additional material                                                                |
| verification_request | Explicit claim/evidence set and named deterministic verifier                                             |
| verification         | Receipt accepted in the projection only after independent local reproduction                             |
| decision             | Explicit `evidence-cut/v1` result over selected claims and reproduced receipts                           |

Dependencies remain pending until present. Invalid semantic references and unsupported
verifiers are retained but blocked. Actor sequence equivocation preserves both events
and quarantines their dependent history. Claim states include UNVERIFIED, SUPPORTED,
REFUTED and DISPUTED; producer confidence never changes these states. Contradictory
values under the same subject/predicate/domain/assumption set remain visible.
Five agreeing claims confer no additional validation authority. Reproduced support
alone accepts a claim in a selected decision cut, refutation alone rejects it,
both or neither leave it unresolved. A later claim does not rewrite a past cut.
Decisions confer neither universal truth nor permission to execute an external action.

The registered `integer-sum/v1` verifier binds the declared input digest, arithmetic
predicate and domain, then reproduces bounded integer addition. It checks the supplied
dataset, not external-world completeness or the truth of declared assumptions.
Replay is deterministic for the same admitted event set, membership policy and fixed
verifier implementations. The event root binds policy and sorted event IDs; it does
not independently commit the verifier implementation or certify global completeness.

## Storage, exchange and isolation

SQLite uses WAL, synchronous FULL and transactional bounded batch insertion. Policies
are pinned in metadata; duplicate events consume no additional capacity. Opening a
journal checks SQLite integrity, every canonical signed event, identifier indexes and
dense local positions. Corruption fails closed. Positions are pagination cursors,
not causal order. SQLite serializes writers; signing sequence allocation is not atomic
across processes: run one signing process per actor. Journal directories/files use
0700/0600 and refuse symlinks. The kill/restart experiment proves acknowledged recovery
for process crash; hardware power-loss durability has not been established. Privileged
whole-database or tail deletion requires an independently retained root/export to detect.

The HTTP adapter binds only 127.0.0.1. APIs are `/health`, `/identity`, `/view`, paged
`/events`, signed `POST /events`, and empty-body `POST /sync` over configured peers.
There is no arbitrary execute endpoint. Static admission scopes actors to event kinds
and claim domains; signed advertisements are not execution authorization. Key files
must be regular files with mode 0600. Keys are never logged or exported.

This slice allows 16 members, 8 configured peers, 4096 stored events, batches of 32,
32 HTTP connections, bounded bytes and request/exchange deadlines. Foreign policies,
invalid signatures, redirects, malformed pages and excess data fail closed. Reordering
and duplicates converge by immutable event-set union with deterministic projection;
missing parents remain pending. Quiescent peers with available capacity can exchange
the full set. A malicious peer can withhold events: matching local roots alone cannot
prove network completeness. Capacity exhaustion sacrifices further ingestion explicitly.

Loopback access assumes a trusted local environment. Reads are not authenticated;
this is not a remotely exposed service. TLS, authenticated public transport, key rotation,
revocation, dynamic admission, public Sybil resistance, stronger DoS controls, private
artifact replication and sandboxed arbitrary execution remain future gates. No secrets
or privileged actions flow through the worker. It invokes registered local verification
only. Byzantine agreement is unnecessary for this immutable event-set experiment;
global authority decisions require a separately justified coordination mechanism.

## Verification and next gate

Tests cover signature/policy/content binding, malformed canonical bytes and quotas,
forged receipts, independent verification, unknown verifiers, conflicting claims,
assumption normalization, 100 seeded delivery permutations, equivocation quarantine,
explicit decision cuts, SQLite restart/corruption/atomicity, malicious peer pages,
redirect/deadline handling and actual process disappearance/rejoin. The existing
compiler regression suite remains separate and runs in Reality Plane CI. Dedicated
Lattice CI also exports and replays a fresh public audit artifact.

Next: version a TaskEnvelope with dependencies, authority and output contract; run
three nodes with independently selected deterministic/provider adapters, scheduled
work and a deliberately invalid contribution. Completion requires task-to-evidence
provenance, preserved disagreements, crash/rejoin, byte-identical replay for pinned
verifiers and no unvalidated model output acquiring authority. Formalization should
begin with reference/quarantine and decision-cut invariants once their executable
semantics stabilize. Sovereign consensus, Sentinel telemetry, Lean and domain engines
integrate through explicit adapters after their respective assurance gates pass.
