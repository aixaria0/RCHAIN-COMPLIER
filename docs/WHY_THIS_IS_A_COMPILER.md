# Why This Is a Compiler

The name is intentional, but it does **not** mean that RChain needs a compiler in order to run.

The Reality Compiler sits one layer above execution. Its input is a heterogeneous set of observations and claims; its output is a normalized, deterministic, inspectable certificate.

```text
observer / node / fixture
          ↓
     raw observation
          ↓
     normalization
          ↓
     evidence model
          ↓
     calculi + replay
          ↓
     proof bundle
          ↓
     RealityCertificate
```

## The compilation boundary

A traditional compiler transforms source representation into a lower-level representation while preserving specified semantics.

Reality Compiler applies the same architectural idea to evidence:

- **Input:** observations, traces, claims, propositions, evidence, replay data.
- **Normalization:** canonical ordering, identifiers, relations, and digests.
- **Analysis:** Reality Calculus and Proposition Calculus.
- **Diagnostics:** missing prerequisites, conflicts, equivocation, and replay divergence.
- **Output:** a deterministic certificate carrying state, provenance, proof obligations, and reasoning artifacts.

The output is therefore not simply `true` or `false`. It is a compiled representation of what the supplied evidence establishes.

## Why not put this into the protocol?

Because the verification boundary and the protocol runtime have different responsibilities.

A consensus protocol must execute within strict operational constraints. An evidence compiler can inspect, replay, compare, diagnose, and preserve artifacts without becoming part of the consensus-critical path.

That separation also makes the system replaceable: a future RChain observer, Sentinel integration, archive, or synthetic fixture can feed the same compiler without requiring the underlying protocol to adopt the entire evidence stack.

## What the compiler protects against

The compiler is designed to distinguish:

```text
executed
observed
reproduced
consistent
verified
```

Those are not synonyms.

A system can execute something without having sufficient independent evidence to verify it. Two observers can report incompatible states. A replay can diverge. A proposition can require evidence that has not arrived yet.

The compiler preserves those distinctions instead of collapsing them into a single success flag.

## Relationship to Web3

This project does not depend on a consumer-Web3 thesis.

Tokens, wallets, speculation, and application adoption are not prerequisites for the core idea. The useful primitive is much narrower: **turn distributed execution evidence into a reproducible object that another system or human can inspect.**

A blockchain can be one evidence provider. It does not have to be the product.

That makes the architecture useful even when the surrounding application layer changes.

## Design target

The long-term target is a provider-neutral evidence compiler:

```text
RChain / Sentinel / archive / another observer
                    ↓
              Reality Adapter
                    ↓
             Reality Compiler
                    ↓
          proof-carrying certificate
```

The current repository is an executable research prototype of that boundary, not a claim that the full production system already exists.
