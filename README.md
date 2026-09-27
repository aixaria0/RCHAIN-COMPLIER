# Causal Assurance Compiler

**A protocol-independent verification and evidence system for turning bounded technical claims into reproducible, inspectable, cryptographically bound assurance artifacts.**

[![CI](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/ci.yml/badge.svg)](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/ci.yml)
[![Verification Core CI](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/verification-core-ci.yml/badge.svg)](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/verification-core-ci.yml)
[![Reality Plane CI](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/reality-ci.yml/badge.svg)](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/reality-ci.yml)
[![Assurance Provenance](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/assurance-provenance.yml/badge.svg)](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/assurance-provenance.yml)

> **Current milestone:** [PR #21 — Generic Causal Assurance Fabric](https://github.com/aixaria0/RCHAIN-COMPLIER/pull/21)
>
> **Current scope:** the generic assurance layer is implemented independently of any live RChain/RNode runtime. RChain/Casper is the first serious target for integration, not a hard dependency of the core.

---

## Why this project exists

Distributed systems research usually produces many useful artifacts, but they often remain disconnected:

- a model checker finds a witness;
- a stress harness produces a failure case;
- a node reports an observation;
- a replay reproduces behavior;
- a CI job passes;
- a UI shows a verdict;
- a reviewer signs a result.

Each artifact may be individually useful, but that still leaves a harder question:

> **Do all of these artifacts still refer to the same run, the same subject, the same evidence, the same assumptions, and the same scope?**

And an even harder one:

> **Can another implementation independently verify that nobody strengthened the claim while moving from model → evidence → verdict → review?**

The Causal Assurance Compiler is built around that problem.

It does not try to replace the system being verified. It creates a **verification boundary around claims about that system**.

The goal is to make a result answerable in a disciplined way:

- What exactly was tested?
- Under what assumptions?
- Was the result bounded or complete?
- Was the witness actually reachable under the declared model?
- What evidence was observed?
- Was that evidence replayed?
- What code/version produced it?
- Did any layer silently promote uncertainty into confidence?
- Is the evidence chain still intact?
- Who signed or reviewed it?
- Can another implementation reproduce the same canonical result?

That is the core value of the project.

---

## The assurance chain

At a high level:

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
portable assurance package
        │
        ▼
canonical package root
        │
        ▼
pinned-key Ed25519 signature
```

The important property is not that these stages exist.

The important property is that **each stage is explicitly bound to the previous stage and is not allowed to silently strengthen its meaning**.

That rule drives the entire architecture.

---

# What PR #21 adds

PR #21 moves the repository beyond a Casper-specific research harness and introduces a protocol-independent assurance layer.

The generic system now includes:

- protocol-neutral verification adapters;
- deterministic adapter selection;
- bounded possibility / counterexample search;
- explicit `INCONCLUSIVE` and `LIMIT_REACHED` outcomes;
- witness polarity semantics;
- raw-byte artifact verification;
- transitive predecessor binding;
- canonical package ordering;
- portable assurance packages;
- length-prefixed canonical root encoding;
- SHA-256 package roots;
- Ed25519 signing;
- independently pinned signer identity;
- cross-language conformance;
- protocol-neutral evidence envelopes;
- claims bound into evidence identity;
- read-only verdict inspection;
- explicit supply-chain / provenance checks;
- optional independent reviewer attestation;
- fail-closed negative controls;
- versioned schemas for semantic changes.

This is deliberately more than a reporting layer.

It is intended to act as a **compiler from bounded technical evidence into an assurance artifact whose scope and integrity survive transport between tools**.

---

# The core design rule

The project follows one rule:

> **A claim must never become stronger while moving through the pipeline unless new evidence explicitly justifies the stronger claim.**

That means:

```text
missing evidence      != PASS
INCONCLUSIVE          != PASS
LIMIT_REACHED         != PASS
hash integrity        != truth
signature validity    != trust
quorum count          != protocol finality
synthetic witness     != live exploit
replay success        != production safety
```

These distinctions are intentionally encoded into the implementation rather than left only as documentation.

---

# 1. Protocol-independent verification compiler

The verification compiler accepts a declared verification problem:

```text
problem id
model family
scope
assumptions
payload
```

and selects one compatible adapter.

Adapter selection is deterministic.

If no adapter exists:

```text
BLOCKED
```

If multiple top-priority adapters tie:

```text
BLOCKED
```

A compiler result cannot silently continue under ambiguity.

The current verification outcomes are:

```text
WITNESS_FOUND
UNREACHABLE_IN_MODEL
LIMIT_REACHED
INCONCLUSIVE
```

These are intentionally not equivalent to PASS/FAIL.

A witness must first have an explicitly declared interpretation:

```text
VIOLATION
SUPPORT
```

For example:

```text
WITNESS_FOUND + VIOLATION → FAIL
UNREACHABLE_IN_MODEL + VIOLATION → PASS

WITNESS_FOUND + SUPPORT → PASS
UNREACHABLE_IN_MODEL + SUPPORT → FAIL

INCONCLUSIVE → BLOCKED
LIMIT_REACHED → BLOCKED
```

Without the declared witness semantics, the result remains BLOCKED.

This prevents a generic reachability result from being given a meaning it did not actually prove.

---

# 2. Evidence is part of the identity

The protocol-neutral observation layer is implemented in **rchain-sentinel**.

The current evidence contract is:

```text
causal-assurance-evidence/v2
```

An evidence envelope binds:

- source;
- evidence kind;
- timestamp;
- subject;
- raw payload SHA-256;
- canonical claims SHA-256;
- resulting evidence identity.

The important change in v2 is that **claims are no longer loose metadata**.

Changing a claim changes the claims digest and therefore changes the evidence identity.

That means this transformation is not allowed to remain invisible:

```text
observed claim
      ↓
claim rewritten later
      ↓
same evidence id
```

Instead:

```text
claim mutation
      ↓
claims digest changes
      ↓
evidence identity changes
```

Payload tampering is also independently detected by recomputing SHA-256 from raw bytes.

---

# 3. Portable assurance package

The portable package contract is:

```text
causal-assurance-portable-package/v2
```

The base chain contains exactly three artifacts:

```text
WITNESS
   ↓
EVIDENCE
   ↓
WORKBENCH
```

A fourth independent reviewer artifact may be appended:

```text
WITNESS
   ↓
EVIDENCE
   ↓
WORKBENCH
   ↓
ATTESTATION
```

For every artifact the verifier independently checks:

1. artifact role;
2. raw artifact bytes;
3. recomputed SHA-256;
4. declared SHA-256;
5. canonical order;
6. exact predecessor bindings.

The chain is transitive.

For example:

```text
WITNESS binds []
EVIDENCE binds [WITNESS]
WORKBENCH binds [WITNESS, EVIDENCE]
ATTESTATION binds [WITNESS, EVIDENCE, WORKBENCH]
```

Changing a predecessor without rebuilding downstream artifacts breaks the chain.

Reordering artifacts breaks the chain.

Substituting a valid artifact from a different package breaks the chain.

Mutating raw bytes while leaving the declared digest unchanged breaks the chain.

---

# 4. Canonical signed package root

Once a package passes independent verification, the system derives a deterministic root.

The root contains the identity and binding structure of the package:

```text
signed-root schema
package schema
run id
subject
artifact index
artifact role
artifact digest
binding count
predecessor bindings
```

These fields are encoded using an explicit:

```text
u32 big-endian length
+
UTF-8 field bytes
```

framing scheme.

This replaces delimiter-based framing and removes ambiguity between cases such as:

```text
["a\0b", "c"]
```

and:

```text
["a", "b\0c"]
```

The canonical material is hashed with SHA-256.

The resulting root can then be signed with Ed25519.

---

# 5. Signature validity is not treated as trust

A recurring security mistake is to accept this logic:

```text
package includes public key
signature verifies under included key
therefore signer is trusted
```

This project explicitly rejects that model.

The signed-root verifier requires both:

1. mathematical signature validity;
2. an independently supplied expected signer fingerprint.

Signer identity is:

```text
SHA-256(raw 32-byte Ed25519 public key)
```

The embedded public key must hash to the declared key id.

That key id must also equal the externally pinned expected key id.

So the trust model is:

```text
valid signature
      +
valid key fingerprint
      +
fingerprint matches configured trust anchor
      =
accepted signer
```

A self-supplied key is not a trust anchor.

---

# 6. Cross-language conformance

The canonical package-root algorithm is independently implemented in:

- TypeScript — **RCHAIN-COMPLIER**
- Rust — **rchain-sentinel**
- Rust — **Sovereign-Lattice**

The frozen four-artifact fixture produces the same package root across all three implementations.

Current v2 frozen root:

```text
sha256:d3dda1ea8d69ef493b83b3b373f6d49c53324a19df127788687db92a31310ace
```

This matters because the producer is not the only implementation defining what the package means.

A second language and a second repository can independently reconstruct the canonical result.

That reduces the chance that one implementation-specific serialization assumption silently becomes the protocol.

---

# 7. Read-only workbench semantics

**rlsenti** is the inspection layer.

Its job is to make evidence understandable without becoming an authority that can upgrade it.

The workbench preserves states such as:

```text
PASS
FAIL
BLOCKED
NOT_TESTED
INCONCLUSIVE
```

It also represents separate assurance planes:

```text
POSSIBILITY
REALITY
CONFORMANCE
RECOVERY
SUPPLY_CHAIN
```

A certificate claiming PASS while containing a critical non-PASS check is rejected.

This is deliberate.

The visualization layer is not allowed to turn uncertainty into confidence merely because a UI needs a simple status.

---

# 8. Optional independent reviewer

**Sovereign-Lattice** acts as an optional independent reviewer.

Its role is not to replace the subject system's consensus.

It adds a second assurance boundary.

The reviewer can bind a decision to:

- certificate digest;
- scope digest;
- reviewer identity;
- review decision.

Current reviewer decisions are:

```text
CONFIRMED
REJECTED
ABSTAINED
```

The attestation is deterministically encoded and can be signed with Ed25519.

Verification requires a pinned signer key id.

The base assurance contract does not require this reviewer.

A stricter policy can.

So both of these are valid configurations:

```text
BASE PROFILE
WITNESS → EVIDENCE → WORKBENCH
```

and:

```text
REVIEWED PROFILE
WITNESS → EVIDENCE → WORKBENCH → ATTESTATION
```

If policy requires attestation and it is missing:

```text
BLOCKED
```

---

# Four repositories, four independent responsibilities

| Repository | Responsibility | What it is not allowed to do |
|---|---|---|
| **[RCHAIN-COMPLIER](https://github.com/aixaria0/RCHAIN-COMPLIER)** | verification, possibility search, conformance, portable package, canonical root | invent live observation evidence |
| **[rchain-sentinel](https://github.com/aixaria0/rchain-sentinel)** | observation/evidence production | decide final protocol meaning on its own |
| **[rlsenti](https://github.com/aixaria0/rlsenti)** | inspection / visualization / evidence navigation | promote an upstream verdict |
| **[Sovereign-Lattice](https://github.com/aixaria0/Sovereign-Lattice)** | optional independent review | replace subject consensus/finality |

The repositories are connected through artifacts rather than hidden shared state.

This separation makes it possible to inspect where a conclusion came from.

See:

[docs/FOUR_REPO_ASSURANCE.md](docs/FOUR_REPO_ASSURANCE.md)

---

# What value this adds to RChain

RChain is where this work started, and it remains the first serious target.

The existing Casper CBC research track already contains:

- deterministic stake distributions;
- adversarial message histories;
- DAG construction;
- equivocation / ordering perturbations;
- minimum-message analysis;
- causal reachability checks;
- exact upstream revision pinning;
- real Rust Finalizer execution;
- upstream validation probes;
- pre-state reconstruction;
- replay-oriented evidence;
- negative controls.

Those pieces are useful individually.

The generic assurance system gives them a common structure.

Future RChain integration can look like:

```text
Casper/CBC search
      │
      ▼
minimum / adversarial witness
      │
      ▼
real RNode/RChain observation
      │
      ▼
native implementation replay
      │
      ▼
build provenance
      │
      ▼
recovery evidence
      │
      ▼
bounded assurance certificate
      │
      ▼
optional independent review
```

This creates a much more useful question than:

> "Did the test pass?"

The intended question becomes:

> **For this exact implementation revision, this exact run, this exact observed state, and this exact replay: what was demonstrated, what evidence supports it, what remains unproven, and can another verifier reproduce the same chain?**

That is the practical reason the generic layer exists.

---

# Why RChain is not connected yet

The current generic milestone deliberately stops at the adapter boundary.

That is intentional.

The upstream RChain/RNode implementation is currently being updated, so coupling the generic assurance core directly to a moving runtime would weaken the separation the project is trying to create.

The generic side is therefore being stabilized first.

When the RChain implementation boundary is ready, the next step is not to redesign the assurance system.

The next step is to implement the RChain adapter and replace generic fixture inputs with:

- real observation evidence;
- real runtime identity;
- real replay output;
- real build provenance;
- real recovery evidence.

In other words:

```text
generic assurance architecture
        +
stable RChain adapter
        =
RChain-specific assurance pipeline
```

Until that adapter exists, this repository does **not** claim that RChain itself is verified by the generic system.

---

# Existing Casper CBC research track

The repository still contains the original Casper CBC stress and implementation research.

Its focused question is:

> **What happens when adversarial-but-causally-valid Casper CBC message histories are exercised against the actual pinned upstream Rust implementation?**

Current upstream pin used by the existing reproducer:

```text
rchain-community/rchain-rust
d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b
```

The research progression reached:

```text
law-level stake tension
        ↓
minimum-message gate
        ↓
concrete DAG/message fixture
        ↓
causal reachability screen
        ↓
Finalizer semantic lock
        ↓
real upstream Finalizer
        ↓
active validation admission
        ↓
pre-state reconstruction
        ↓
checkpoint validation
        ↓
MultiParentCasper validation
```

The duplicate-sender candidate that drove part of this research is intentionally narrow:

```text
minimum-message senders = [v0, v0, v1, v2]
bonded validators       = [v0, v1, v2, v3]
supporting stake        = 90 / 100
```

The measurable implementation boundary is:

```text
count(minimumMessages) = count(bonds)
but
count(distinct senders) < count(bonds)
```

The harness observes how the pinned implementation handles that shape.

It does not automatically label the behavior a production exploit.

See:

[docs/CASPER_CBC_RESEARCH_STATUS.md](docs/CASPER_CBC_RESEARCH_STATUS.md)

---

# Evidence levels

The project separates evidence strength into distinct levels.

| Level | Meaning |
|---|---|
| **Synthetic scenario** | deterministic generated case |
| **Model result** | result inside a declared formal/algorithmic model |
| **Reachable witness** | witness satisfying declared reachability constraints |
| **Implementation behavior** | same shape executed against the implementation under study |
| **Observed runtime behavior** | evidence from an identified real execution |
| **Recovery/replay evidence** | state or behavior reproduced under declared recovery conditions |
| **Protocol claim** | conclusion supported at protocol semantics level |
| **Production claim** | conclusion supported under real deployment assumptions |

The existence of one level does not imply the next.

This distinction is part of the project's claim discipline.

---

# Threat model

The generic assurance layer is designed to detect or block several classes of evidence failure.

### Artifact mutation

An artifact's raw bytes are changed after generation.

**Defense:** recompute SHA-256 from raw bytes.

### Artifact substitution

A valid artifact from another run is inserted.

**Defense:** ordered predecessor bindings + package identity + canonical root.

### Artifact reordering

Artifacts are rearranged without changing individual hashes.

**Defense:** canonical role ordering.

### Claim rewriting

Observation claims are changed while payload identity is preserved.

**Defense:** canonical claims digest is bound into evidence identity.

### Signer substitution

An attacker signs a modified package with their own key and includes that key.

**Defense:** externally pinned expected signer fingerprint.

### Verdict promotion

A downstream tool turns uncertain upstream state into PASS.

**Defense:** explicit outcome mapping + workbench contradiction rejection.

### Ambiguous serialization

Different field boundaries produce the same serialized byte stream.

**Defense:** length-prefixed canonical framing.

### Missing review under strict policy

Optional attestation is omitted when policy requires one.

**Defense:** fail closed to BLOCKED.

---

# What the generic layer can guarantee

Within its declared scope, the current system can provide evidence that:

- artifact bytes match their declared digests;
- artifact ordering is canonical;
- predecessor bindings are intact;
- package identity is included in the root;
- signer key fingerprint matches the configured trust anchor;
- a signature is mathematically valid;
- multiple independent implementations reproduce the same canonical root;
- inconclusive results were not promoted to PASS;
- evidence claims were not silently rewritten without changing identity;
- a PASS certificate does not contradict critical non-PASS checks.

These are integrity and semantic guarantees about the assurance chain.

They are intentionally narrower than claims about the truth of the external system.

---

# What the generic layer cannot guarantee by itself

It does **not** prove:

- that a sensor or observer told the truth;
- that an external node was uncompromised;
- that a network observation represents the full network;
- that a bounded search covered an unbounded state space;
- that a hash proves the meaning of the bytes it protects;
- that a cryptographic signer is organizationally authorized unless policy says so;
- that consensus finality follows from quorum count alone;
- that one successful replay proves production safety;
- that RChain/RNode is correct;
- that a synthetic or controlled fixture is a live exploit;
- that external security review is unnecessary.

These limits are deliberate and documented.

---

# CI and negative controls

The generic core is covered by dedicated CI and repository-wide validation.

Current checks include:

- repository CI;
- Verification Core CI;
- Reality Plane CI;
- build provenance checks;
- upstream RChain reproducer workflows;
- Sentinel CI;
- Sovereign-Lattice CI;
- Sovereign cluster smoke tests;
- Lean 4 verification;
- rlsenti CI.

Negative controls include:

- raw-byte mutation;
- digest mismatch;
- artifact substitution;
- artifact reordering;
- wrong predecessor binding;
- wrong signer;
- mismatched key id;
- malformed signature;
- changed run id;
- changed subject;
- critical INCONCLUSIVE hidden beneath PASS;
- missing required attestation.

The system is expected to fail closed under these cases.

---

# Reproduce the generic core

Install dependencies:

```bash
npm install
```

Run the verification-core suite:

```bash
npm run test:verification-core
```

Run the full repository suite:

```bash
npm test
```

Run quality gates:

```bash
npm run typecheck
npm run lint
npm run build
```

Run the generic verification compiler example:

```bash
npm run demo:verification-core
```

The RChain upstream reproducers run in GitHub Actions against pinned source revisions so the exact source boundary remains visible.

---

# Repository structure

```text
src/lib/compiler/
    verification compiler
    adaptive verification adapters
    possibility search
    multi-objective refinement
    quantitative what-if analysis
    ecosystem evidence chain
    portable assurance package
    signed package root
    provenance adapters
    replay adapters
    recovery adapters
    assurance certificate logic

src/lib/cbc/
    Casper CBC simulator
    stake analysis
    DAG/message construction
    upstream semantics
    adversarial search
    reachability search
    finalizer probes
    fragility analysis

scripts/upstream/
    pinned upstream Rust reproducers

schemas/
    causal assurance contract versions

docs/
    architecture
    assurance contract
    evidence discipline
    Casper/CBC research status

.github/workflows/
    repository CI
    verification core
    Reality Plane
    provenance
    pinned upstream reproductions
```

---

# Contract versions

Current generic contract versions:

| Contract | Version |
|---|---|
| Evidence envelope | `causal-assurance-evidence/v2` |
| Ecosystem manifest | `causal-assurance-ecosystem/v2` |
| Portable package | `causal-assurance-portable-package/v2` |
| Signed package root | `causal-assurance-signed-root/v2` |
| Reviewer attestation | `causal-assurance-attestation/v2` |

Semantic changes are versioned rather than silently changing the meaning of an existing schema.

The older v1 ecosystem schema remains preserved for compatibility with the earlier four-stage mandatory-attestation contract.

---

# Intended use

The generic assurance layer is suitable for systems where a useful result has to survive movement between:

- model/search engines;
- runtime observers;
- replay tools;
- provenance systems;
- verification workbenches;
- independent reviewers.

It is intentionally not limited to blockchain.

A future adapter could represent:

- distributed consensus;
- replicated databases;
- recovery testing;
- safety-critical state machines;
- deterministic simulation;
- build/runtime provenance chains;
- formal-model-to-runtime conformance.

The core only requires that evidence and semantics can be expressed through the declared adapter boundary.

---

# Current status

## Generic assurance system

The current v2 milestone is implemented and CI-gated.

The main generic boundaries are now in place:

```text
bounded verification
        ✓
explicit uncertainty
        ✓
evidence identity
        ✓
raw-byte verification
        ✓
transitive binding
        ✓
portable package
        ✓
canonical root
        ✓
Ed25519 signature
        ✓
pinned signer trust
        ✓
cross-language conformance
        ✓
read-only verdict inspection
        ✓
optional independent review
        ✓
negative controls
        ✓
```

## RChain integration

Not yet connected to the currently changing live RChain/RNode runtime.

That is the next external boundary.

The generic system is being kept stable so that when the RChain implementation is ready, integration can happen through an adapter rather than by mixing RChain-specific assumptions into the core.

---

# Why this matters

The project is not trying to make every result look stronger.

It is trying to make every result **harder to misstate**.

A useful assurance system should preserve uncertainty as carefully as it preserves success.

It should make it obvious when:

- evidence is missing;
- a search stopped early;
- a result only applies to a model;
- a runtime observation was not independently reproduced;
- a signer is valid but not trusted;
- a reviewer was not present;
- a production claim has not yet been earned.

That is the standard this repository is moving toward.

---

# License

No license is currently declared for this repository.

Public visibility should not be interpreted as a grant of reuse rights.

---

# Security

Consensus-sensitive or security-sensitive findings should be handled carefully.

See [SECURITY.md](SECURITY.md).

---

# Contributing

A research contribution should include, where applicable:

- exact implementation revision;
- deterministic reproducer;
- declared assumptions;
- declared limitations;
- subject identity;
- artifact digests;
- evidence bindings;
- observed result;
- negative control;
- smallest claim actually supported by the evidence.

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Short version

If you only read one paragraph:

**RCHAIN-COMPLIER is evolving into a protocol-independent Causal Assurance Compiler: a system that takes bounded verification results, observation evidence, replay/provenance information, and optional independent review, then binds them into a portable, reproducible, cryptographically verifiable chain without allowing uncertainty to be silently promoted into PASS. RChain/Casper is the first serious target; the generic system is intentionally being stabilized first so the real RChain adapter can be attached cleanly when the upstream runtime boundary is ready.**
