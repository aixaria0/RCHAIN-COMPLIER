# RChain Proposition Mapping

This document records the architectural correspondence between the RChain Architecture Documentation (Release 0.8.1) and the executable Reality Layer primitives in this repository.

## Proposition-based consensus

The RChain architecture describes consensus as stake-based betting on logical propositions rather than only whole blocks. A proposition can encode statements about proposed state transitions and ordering constraints. Validators compute a maximally consistent subset of propositions and use that result to materialize the next block.

The current implementation maps those concepts as follows:

| RChain concept | Reality Layer primitive |
| --- | --- |
| logical proposition | `RealityProposition` |
| conflict relation | `conflictsWith` |
| prerequisite relation | `requires` |
| maximally consistent subset | `selectMaximallyConsistentPropositions()` |
| convergence rounds | `ConvergenceTrace[]` |
| fixed point | `fixedPoint` |
| bet source/target | `RealityBet.source` / `target` |
| claim | `RealityBet.claim` |
| belief | `RealityBet.belief` |
| justification | `RealityBet.justification` |
| equivocation signal | `detectEquivocation()` |
| auditable result | `RealityEngineCertificate` |

## What is deliberately not claimed

The implementation does not claim to reproduce the historical RChain consensus implementation, its game-theoretic payoff model, or its network protocol. The mapping is an executable research boundary: it makes the relevant logical structures concrete and testable without pretending that a local engine is the live consensus protocol.

## Engine position

```text
RChain observer evidence
        ↓
   RealityRecord
        ↓
 Proposition layer
        ↓
 consistency / prerequisites
        ↓
 maximally-consistent set
        ↓
 convergence / fixed point
        ↓
 justification / equivocation analysis
        ↓
 RealityCertificate
```

This boundary is intentionally useful before live consensus wiring exists because the same evidence model can be populated by synthetic fixtures, `rchain-sentinel`, or future protocol adapters.
