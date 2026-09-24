# Casper slashing conformance — source-pinned investigation

Target: `rchain-community/rchain-rust@9f06172567d28e306a8649f4d85ba6d9c1cf2c75` (dev snapshot). Research-only: do not change upstream consensus or imply a deployed exploit.

## Source-confirmed decision path

1. `casper/src/dag.rs`: a second distinct block with the same sender and sequence number is rejected before inserting its metadata. This is **not** proof of a slashing event.
2. `casper/src/blocks/proposer/proposer.rs`: offenders are senders of `pre_state.justifications` whose metadata has `validation_failed`. The proposed `to_slash` set is the intersection with validators that have a positive pre-state bond.
3. `casper/src/blocks/proposer/block_creator.rs`: a block proposal includes one deterministic `SystemDeploy::slash` for each selected offender; it is not executed merely by flagging a block.
4. `rholang/src/native_state.rs`: `slash` removes the validator from the bond pool, active set, pending requests and withdrawal claims and moves the bond from the staking vault into the Coop vault. At a normal epoch boundary, a pending withdrawal becomes an escrowed claim; the order of the two operations is an important test boundary.
5. `spec/Rchain/Pos.lean`: epoch/bond/withdrawal state-machine laws exist. Do not infer that the complete proposer offender-selection pipeline has been formally tied to these laws.

## Reproducible research questions (hypotheses, NOT findings)

- Invalid block is recorded but not present among the next proposer's selected justifications: does slash get scheduled? Verify actual reachability and whether any alternative slash path exists.
- Two same-sequence blocks: the second is rejected before DAG metadata insertion. Distinguish rejection from punishable evidence, and check whether the first block can still be finalized.
- An invalid block becomes selected and its sender remains bonded: is a slash system deploy included, replayed and persisted exactly once?
- Withdrawal requested before the offence: compare slash-before-boundary, slash-at-boundary and boundary-before-slash, including escrow, rewards, bond pool and active membership.
- A healthy validator with delayed or reordered messages must not be slashed merely for network delay.
- A bond-free or already-slashed validator must not be double-confiscated; the total REV across staking, Coop and validator vaults must be conserved.

## Acceptance criteria

Each case must pin the actual source revision and construct a reachable, distinct-ID DAG and state fixture. Record the validation outcome, metadata flags, selected justifications, computed `to_slash`, proposed system deploys, executed native state transition, and post-state vault/bond/active/pending/claims. Separate MODEL-ONLY, Rust-unit, Rust-integrated, wire-valid and live-network evidence. Require positive and negative controls, deterministic replay digest, and CI logs. Fail closed when the source revision, Rust test or ingress check cannot be verified.

## Immediate boundary

This document is an investigation charter, **not** a claim that an exploit, a slashing-policy defect or a successful Rust replay has been demonstrated. Existing #16 is read-only; #17 is not touched. Investigate and make fixes only on this dedicated branch.
