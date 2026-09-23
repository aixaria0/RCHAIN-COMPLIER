# Review entry point: actual Rust observations → existing Lean stake law

This extends the existing PR #17 evidence pipeline in the direction of proof/code
conformance. PR #16 remains a pinned read-only input. No upstream production code
or mathematical definition is changed.

## Established source-level observation

At orchestrator `8db29fbe10ae26bd9f9fc4fa0ed1bd591d10a70a`,
[CI run 35805385622](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/35805385622)
executed the complete selected source DAG on all four pinned Rust implementations.
Downloaded raw evidence was revalidated with `cbc_compare_exact_rust_dag.py`.

- Source research commit: `2d2c3d879b1a078693c8551385efb54a811d7172`.
- Selected distinct IDs: `a2,a3,b2,c2`; 16 source messages retained.
- Graph SHA-256: `d5145646e47d650acfdfc87d44d02e6eb5c9e126eed7d61bc5adf21b2e494281`.
- Packet SHA-256: `c450664b02b1d61331b9284ebad5ede2928ae72fd788b3e29956022e315c4484`.
- All four: supporting stake **70**, total stake **100**, initial fringe predicate
  **true**, final new fringe IDs **a1,b1,c1**.
- No difference at the compared initial-iteration stages. Minimum extraction is a
  test projection of a private method; public support and Finalizer calls execute
  real code. This is not a complete internal iteration trace.

The census remains 105 distinct-ID candidates, 81 with minimum-sender undercoverage,
43 undercoverage/model-finalizing candidates. Only one has this exact Rust replay.
The original repeated-ID M27 tuple and M11.5 remain separate controls.

## New automated proof obligation

`tools/cbc_check_lean_stake.py` revalidates raw four-Rust records, logs, generated
Rust source, source pins, packet and census before generating twelve concrete Lean
proofs (supporting stake, total stake, fringe predicate for each implementation).
It imports the **existing** `Rchain.Casper.Stake` at community revision
`7b986ee48cc1c0c09e21543c8ef01f84114d73b6`, with its Lean 4.12.0 toolchain and
committed mathlib dependency manifest.

The actual Rust support maps and source bonds become concrete inputs to
`fullPartitionStake`, `totalStake`, and `calculateFringe`. Every equality uses
`by decide`; `#print axioms` must report no axioms for each new theorem.
Missing declarations, admissions and nonempty axiom dependencies fail the job.
Two deliberately mutated controls (changed supporting stake and changed bonds)
must be rejected by Lean at `decide` proof checking; their proof sources and raw
failure logs are retained separately from the genuine observations.
The generated proof, source/manifest hashes, sender mapping, toolchain version,
raw output, exit code and report binding are uploaded as
`exact-dag-lean-stake-conformance`.

Status: **CI-VERIFIED at `24ecc9d78790a4951bfdad110c3ee68bf13b9851`** in
[run 35876517742](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/35876517742).
All four Rust runs and comparison passed. Lean 4.12.0 accepted all twelve concrete
equalities with empty axiom audits; both mutations failed at `decide` (exit 1).
The downloaded receipt and every retained output digest were independently
checked before this checkpoint was committed.

Review the [actual Lean proof](../artifacts/cbc-lean-stake-35876517742/ExactReplayStake.lean)
and [frozen receipt/logs](../artifacts/cbc-lean-stake-35876517742/README.md) directly.
This result belongs to that exact revision/run, not automatically to later HEADs.

## Representation contract and remaining proof work

| Boundary | What this change establishes | What remains open |
| --- | --- | --- |
| Rust strings → Lean Nat | Recorded order-preserving bijection over every observed sender | A formal proof of the Python serializer |
| BTreeMap/BTreeSet → Lean lists | Sorted unique sets required; reordered/duplicate lists rejected | Universal refinement of list and tree implementations |
| Support map → stake gate | Kernel-checked equalities for these concrete observations, when CI succeeds | All-input Rust/spec equivalence; bounded integer overflow analysis |
| Causal DAG → support map | Executed Rust and TypeScript intermediate comparison | Lean derivation of the support map from the exact DAG |
| Minimum-message gate | Existing count and sender-coverage observations retained | Intended invariant across epochs/bond changes and liveness effects |
| Finalizer → block ingress | No new claim | Signed block construction, validation, insertion, first rejection |

Lean's unbounded `Nat` and Rust integer bounds are not assumed equivalent for all
inputs. These small concrete inputs avoid that issue. Community's Lean definition
is the comparison oracle for the other three source snapshots; no claim is made
that those forks contain or endorse that specification.

This is finite source-level conformance. It is not a universal correctness proof,
a Casper safety proof, ingress verification, a live-network result, or a protocol
fix. An observed mismatch must fail and remain visible; do not change production
Rust to force agreement.
