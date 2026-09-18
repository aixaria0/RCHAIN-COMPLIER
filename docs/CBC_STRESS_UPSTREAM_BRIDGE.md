# CBC Stress Lab — upstream bridge

The stress harness is the first executable research slice for the Casper CBC direction.

It is synthetic-first by design. The simulator creates controlled validator, network, ordering and equivocation faults. It reports the resulting observations, convergence trace, justification graph and replay digest.

## Why the model is shaped this way

The current `rchain-community/rchain-rust` tree exposes several concrete Casper surfaces that are useful as the next observation boundary:

- `casper/src/multi_parent_casper.rs` contains multi-parent justification handling, latest-message parent selection, bonds-map handling, fringe calculation and block replay validation.
- `legacy/casper/src/main/scala/coop/rchain/casper/MultiParentCasper.scala` is the legacy Scala oracle for that flow.
- `legacy/casper/src/main/resources/casper.tla` models message transfer, message loss, node states and fairness assumptions.
- `spec/Rchain/Casper/Validate.lean` states executable-form laws around block height, sequence numbers, content addressing, merge channels and fringe identity.

The new `CasperBlockObservation` type mirrors those observable concepts without copying upstream implementation code.

## Observation boundary

A block observation contains:

```text
blockHash
sender
blockNum
seqNum
justifications
bondsMap
fringe
preStateHash
postStateHash
```

The adapter turns that into:

```text
CasperBlockObservation
       |
       +--> RealityBet
       |
       +--> RealityProposition
       |
       +--> canonical observation digest
```

That gives the stress lab a stable interface for the next stage: feed real DAG/block observations into the same evidence machinery used by synthetic scenarios.

## Research discipline

A stress result is evidence about the modeled scenario.

It is not automatically evidence that the production protocol is unsafe.

A proposed improvement is initially a hypothesis. It becomes a protocol finding only after the scenario is connected to the faithful upstream implementation or formal specification and the behaviour is reproduced there.
