# Causal Assurance Compiler

**Turn a verification claim into a reproducible evidence chain that another implementation can independently check.**

[![CI](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/ci.yml/badge.svg)](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/ci.yml)
[![Verification Core CI](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/verification-core.yml/badge.svg)](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/verification-core.yml)
[![Reality Plane CI](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/reality-plane.yml/badge.svg)](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/reality-plane.yml)

> **Current milestone:** [PR #21 — Generic Causal Assurance Fabric](https://github.com/aixaria0/RCHAIN-COMPLIER/pull/21)
>
> **Scope:** the generic assurance layer is protocol-independent. RChain/Casper is the first serious research target, not a hard dependency of the core.

---

## The problem in one sentence

A test result is easy to produce. A result that preserves **exactly what was tested, what evidence supported it, what assumptions were used, who attested to it, and whether another implementation can reproduce the same chain** is much harder.

This project builds that second thing.

```text
verification problem
        │
        ▼
bounded search / witness
        │
        ▼
observation evidence
        │
        ▼
inspection / verdict
        │
        ▼
optional independent attestation
        │
        ▼
portable package
        │
        ▼
canonical signed root
```

Every stage is explicit, digest-bound, independently checkable, and fail-closed.

---

## Why this exists

Distributed systems research often produces useful pieces in isolation:

- a model finds a counterexample;
- a node reports an observation;
- a replay says the behavior reproduced;
- a UI shows a verdict;
- a reviewer signs off;
- CI says the commit passed.

The difficult question is whether those pieces still refer to **the same run, the same evidence, the same subject, and the same assumptions**.

The Causal Assurance Compiler treats that linkage as a first-class artifact.

It is designed so that a consumer can ask:

> **What exactly was demonstrated, under which scope, from which evidence, and can I independently verify that the chain has not been strengthened or rewritten?**

---

## What is implemented now

### 1. Protocol-independent verification compiler

The core selects a compatible verification adapter deterministically and refuses ambiguous top-priority choices.

Possible outcomes are explicit:

```text
WITNESS_FOUND
UNREACHABLE_IN_MODEL
LIMIT_REACHED
INCONCLUSIVE
```

A result is never silently promoted. In particular:

- `INCONCLUSIVE` → **BLOCKED**
- `LIMIT_REACHED` → **BLOCKED**
- reachability only becomes PASS/FAIL after the caller explicitly declares whether a witness represents **SUPPORT** or a **VIOLATION**

That distinction is intentional: finding a witness is not inherently good or bad until the property being checked is defined.

### 2. Portable assurance packages

`causal-assurance-portable-package/v2` carries the chain:

```text
WITNESS → EVIDENCE → WORKBENCH
                       │
                       └── optional ATTESTATION
```

For every artifact the verifier:

1. rehashes the raw bytes;
2. checks the declared SHA-256;
3. checks canonical role order;
4. checks all predecessor bindings;
5. rejects substitutions, reordering, or broken linkage.

The reviewer stage is optional in the base contract and can be required by policy.

### 3. Canonical signed root

A valid portable package is reduced to a deterministic root using an unambiguous **u32 big-endian length-prefixed encoding**.

```text
package identity
+ ordered artifact roles
+ artifact digests
+ predecessor bindings
        │
        ▼
canonical bytes
        │
        ▼
SHA-256 root
        │
        ▼
Ed25519 signature
```

The signed-root verifier does not trust a public key simply because it arrived inside the envelope.

The signer must also match an **independently pinned expected key fingerprint**.

### 4. Cross-language conformance

The same frozen package is independently reproduced by:

- TypeScript in **RCHAIN-COMPLIER**
- Rust in **rchain-sentinel**
- Rust in **Sovereign-Lattice**

All three implementations derive the same canonical root for the same four-artifact fixture.

This is useful because the evidence format is not validated only by the implementation that created it.

### 5. Fail-closed workbench behavior

**rlsenti** acts as an inspection surface, not an authority that may upgrade results.

It preserves non-success states and rejects contradictory certificates, including a certificate claiming PASS while a critical check remains:

```text
FAIL
BLOCKED
NOT_TESTED
INCONCLUSIVE
```

### 6. Independent reviewer attestation

**Sovereign-Lattice** can attach an optional reviewer decision to the assurance chain.

Its attestation is:

- bound to certificate and scope digests;
- deterministically encoded;
- signed with Ed25519;
- verified against a pinned signer identity.

The reviewer is an additional assurance layer. It does not replace the subject system's own consensus or finality.

---

## Four repositories, four responsibilities

| Repository | Responsibility | Trust boundary |
|---|---|---|
| **[RCHAIN-COMPLIER](https://github.com/aixaria0/RCHAIN-COMPLIER)** | verification, bounded search, package construction, canonical root | cannot invent observation evidence |
| **[rchain-sentinel](https://github.com/aixaria0/rchain-sentinel)** | protocol-neutral observation evidence | payload and canonical claims are bound into evidence identity |
| **[rlsenti](https://github.com/aixaria0/rlsenti)** | inspection / workbench | cannot promote an upstream verdict |
| **[Sovereign-Lattice](https://github.com/aixaria0/Sovereign-Lattice)** | optional independent reviewer | attestation must bind the existing chain and trusted signer |

The key rule is simple:

> **No layer is allowed to silently strengthen the claim made by the layer before it.**

See [docs/FOUR_REPO_ASSURANCE.md](docs/FOUR_REPO_ASSURANCE.md) for the contract.

---

## What this gives RChain

RChain is the first concrete system this infrastructure has been used to investigate.

The existing Casper/CBC research track already contains deterministic stress cases, DAG construction, reachability analysis, upstream Rust execution, replay evidence, and implementation-boundary probes.

The generic assurance layer gives those pieces a common destination:

```text
Casper/CBC search
      │
      ▼
real RChain observation
      │
      ▼
implementation replay
      │
      ▼
provenance / recovery evidence
      │
      ▼
bounded assurance verdict
      │
      ▼
independent review
```

The important boundary is that this repository **does not currently claim that RChain itself is verified by the generic system**.

The generic layer has intentionally been completed independently while the upstream RChain/RNode implementation is changing. When that implementation boundary is ready, the next step is an adapter that replaces the remaining generic fixtures with real RChain observation and replay evidence.

That keeps the assurance architecture stable while the subject implementation moves.

---

## Current RChain research track

The repository also contains the earlier Casper CBC stress harness.

Its purpose is narrower:

> **What happens when adversarial-but-causally-valid Casper CBC histories are exercised against the pinned upstream Rust finalization and validation path?**

Pinned upstream revision used by the existing reproducer:

```text
rchain-community/rchain-rust
d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b
```

The existing research progression reached real upstream Rust execution:

```text
law-level stake tension
        ↓
minimum-message gate
        ↓
concrete DAG/message fixture
        ↓
causal reachability screen
        ↓
Finalizer semantics
        ↓
real upstream Finalizer
        ↓
active validation admission
        ↓
pre-state reconstruction
        ↓
checkpoint / MultiParentCasper validation
```

This remains an implementation finding under controlled conditions, not a claim of a production-network exploit.

See [docs/CASPER_CBC_RESEARCH_STATUS.md](docs/CASPER_CBC_RESEARCH_STATUS.md).

---

## Evidence discipline

The project deliberately separates levels of claim:

| Level | Meaning |
|---|---|
| **Model result** | result inside a declared abstract/bounded model |
| **Reachable witness** | witness satisfying the currently checked structural constraints |
| **Implementation behavior** | the shape was exercised against the implementation being studied |
| **Observed system behavior** | evidence came from an identified real execution |
| **Protocol / production claim** | requires additional operational and protocol evidence |

A stronger label is never inferred only because a weaker layer passed.

---

## Security properties enforced by the generic core

The current contracts enforce:

- deterministic adapter selection;
- explicit assumptions and limitations;
- no `INCONCLUSIVE → PASS` promotion;
- explicit witness polarity before PASS/FAIL mapping;
- raw-byte digest recomputation;
- ordered transitive artifact bindings;
- deterministic cross-language root derivation;
- length-prefixed canonical framing;
- Ed25519 signature verification;
- independently pinned signer fingerprints;
- optional reviewer policy without silently weakening stricter profiles;
- versioned contracts for semantic changes;
- negative tests for mutation, substitution, reordering, wrong signer, malformed signature, changed run identity, and changed subject identity.

The system is designed to make unsupported certainty difficult to encode.

---

## What this does **not** prove

This project does not claim to:

- prove arbitrary distributed systems correct;
- replace RChain consensus or RNode;
- turn a bounded model result into a network fact;
- treat a hash as proof that the underlying observation is true;
- treat an embedded public key as a trust anchor;
- convert missing evidence into PASS;
- establish production safety without real runtime evidence;
- replace an external security review.

The generic core protects the integrity and semantics of the evidence chain. The truth of an external observation still depends on how that observation was obtained.

---

## Reproduce the generic verification core

Install dependencies:

```bash
npm install
```

Run the verification-core tests:

```bash
npm run test:verification-core
```

Run the main repository gates:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Run the generic verification demo:

```bash
npm run demo:verification-core
```

The repository CI also runs the upstream RChain reproducers against pinned source revisions.

---

## Repository map

```text
src/lib/compiler/
    verification compiler
    possibility / multi-objective search
    evidence-chain contracts
    portable assurance package
    canonical signed root
    provenance / replay / recovery adapters

src/lib/cbc/
    Casper CBC research harness
    DAG construction
    finalizer semantics
    adversarial / reachability searches

scripts/upstream/
    pinned upstream Rust reproducers

schemas/
    versioned assurance contracts

docs/
    architecture
    evidence discipline
    Casper/CBC research status

.github/workflows/
    verification core
    provenance
    Reality Plane
    upstream reproductions
```

---

## Design principle

The project is built around one rule:

> **A claim should never become stronger as it moves through the evidence pipeline unless new evidence explicitly justifies the stronger claim.**

That is the purpose of the compiler, the package format, the workbench boundary, the signed root, and the optional reviewer layer.

---

## Status

The **generic assurance v2 milestone is implemented and CI-gated**.

The next major boundary is not another generic feature. It is connecting a stable external implementation to the existing adapter interface and replacing fixture evidence with real observation/replay evidence.

For the RChain track, that connection is intentionally waiting on the current upstream RChain/RNode work before being made.

---

## License

No license is currently declared for this repository. Public visibility should not be interpreted as a grant of reuse rights.

## Security

Consensus-sensitive findings should be handled carefully. See [SECURITY.md](SECURITY.md).

## Contributing

A research contribution should include the exact implementation revision, deterministic reproducer, declared assumptions, observed result, evidence bindings, and the smallest claim actually supported by that evidence. See [CONTRIBUTING.md](CONTRIBUTING.md).
