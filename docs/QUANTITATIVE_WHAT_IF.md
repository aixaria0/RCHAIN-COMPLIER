# Finite-state quantitative what-if analysis

`src/lib/compiler/quantitative-what-if.ts` is a domain-independent layer over
the finite weighted graph search. A caller supplies states, transitions,
non-negative costs, and a goal predicate. Transitions may require named
components to remain failed or operational for the entire scenario. The
`maxFailures` bound counts distinct failed components, not occurrences of a
failure condition along a path.

The analyzer first searches an over-approximation that checks each transition
locally but forgets cross-transition consistency. An abstract `UNREACHABLE`
result is conclusive within the supplied graph. A reachable abstract witness
is checked against a single static failure assignment. A feasible minimum
abstract witness is also a minimum concrete witness because the concrete
traces are a subset of the abstract traces. If the witness is spurious, an
exact search over `(state, failed set, operational set)` finds the cheapest
consistent witness or proves unreachability within the finite input graph.
Exhausting `maxStates` returns `INCONCLUSIVE`, never `UNREACHABLE`.

This is inspired by the use of approximation, witness validation, and
quantitative reachability in AalWiNes. It does **not** implement its weighted
pushdown automata or assert its polynomial-time result. The exact fallback
can grow exponentially with the number of component identities. State keys
must uniquely identify every semantically distinct caller state; transitions
and costs must be deterministic and valid for the chosen static scenario.
The result is evidence only about the caller-supplied graph and assumptions.

Run the focused tests with:

```sh
node --experimental-strip-types --test src/lib/compiler/quantitative-what-if.test.ts
```
