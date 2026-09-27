# Protocol-Agnostic Verification Compiler

This layer is intentionally independent of any blockchain, consensus protocol, node implementation, or live network.

Its purpose is to turn a verification question into a scoped machine artifact while keeping the model choice explicit.

## Core pieces

### 1. Lexicographic multi-objective search

`searchLexicographicPossibility()` accepts an explicit finite transition system and a named cost vector.

Example objective vector:

```text
[actors_affected, structural_changes, latency]
```

Costs are accumulated component-wise and compared lexicographically. The first dimension dominates the second, the second dominates the third, and so on.

The result is one of:

- `REACHABLE`
- `UNREACHABLE`
- `LIMIT_REACHED`

A reachable result contains the lexicographically minimum witness inside the declared finite model. `LIMIT_REACHED` is never promoted to absence of a witness.

### 2. Adaptive verification compiler

`compileVerification()` receives a protocol-neutral problem plus a set of adapters.

Each adapter declares:

- model family;
- version;
- priority;
- a support predicate;
- a verifier.

Selection is fail-closed:

- no compatible adapter -> `BLOCKED`;
- equal-priority ambiguity -> `BLOCKED`;
- mismatched artifact identity -> `BLOCKED`;
- exactly one highest-priority compatible adapter -> execute it.

This allows future domains to provide specialized engines without hard-coding one formalism as universally correct.

### 3. Finite-state adapter

`createFiniteStateLexicographicAdapter()` turns an explicit finite transition system into a standard `verification-artifact/v1`.

The artifact records:

- problem/model/adapter identity;
- outcome;
- scope;
- assumptions;
- limitations;
- witness;
- minimality claim;
- exploration metrics.

`UNREACHABLE_IN_MODEL` means only that the supplied finite transition relation was exhausted. It is not a protocol-wide correctness claim.

## Design boundary

The generic core does not import Casper, RNode, Sentinel, Rholang, or any RChain-specific type.

Domain-specific code may depend on this core. The core must not depend on a domain adapter.

That dependency direction is deliberate:

```text
protocol-neutral verification core
        ^
        |
domain adapters
        ^
        |
real systems
```

This keeps verification research moving even when a target system is being actively changed by its maintainers.

## Why this structure

Different systems need different formal models. A finite graph, causal DAG, pushdown system, bounded-width dynamic program, SMT model, or native replay engine can all become adapters as long as they expose scoped artifacts and explicit limitations.

The compiler therefore selects a verifier; it does not pretend one verifier is universally valid.
