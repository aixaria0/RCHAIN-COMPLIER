# RChain C192 live upstream witness

This integration is the first unresolved upstream RChain finding carried through the Intelligence Lattice evidence lifecycle.

## Upstream subject

- repository: `rchain-community/rchain-rust`
- issue: [#172 — C192](https://github.com/rchain-community/rchain-rust/issues/172)
- pinned revision: `51935310789a1a75a183ad0af7152e4eef450c88`
- source: `node/src/runtime/node_runtime.rs`
- upstream falsifier: `a_round_that_comes_to_rest_at_one_height_is_sealed_by_its_own_bound`
- committed measurement reference: `spec/audit/evidence/n149-results.md`

The upstream test executes the attestation-tap sequence that distinguishes a round whose peer blocks all remain at one height from the control sequence whose heights keep advancing.

## CI path

```text
pinned rchain-rust checkout
        |
        v
targeted upstream cargo test
        |
        v
source + evidence + output SHA-256
        |
        v
rchain-c192-upstream-witness/v1
        |
        v
TaskEnvelope
        |
        v
claim + evidence
        |
        v
two independent lattice workers
        |
        v
reproduction certificate
        |
        v
real coordinator SIGKILL
        |
        v
SQLite journal restart/rejoin
        |
        v
exported event history
        |
        v
independent deterministic replay
```

The witness binds the exact upstream revision, test name, command, source digest, committed measurement digest, cargo-output digest and Actions run URL. The verifier refuses a substituted revision or malformed witness rather than weakening the claim.

## Exact claim

The lifecycle supports only this bounded statement:

> The pinned upstream C192 unit falsifier executed successfully at the declared `rchain-rust` revision, and that execution artifact remained task-bound and replayable through the three-process evidence lifecycle.

## What it does not claim

This gate does **not** claim that:

- issue #172 is fixed;
- the multi-validator devnet measurement was rerun by this workflow;
- the correct C192/C171 repair has been designed;
- replacing `>` with `>=` is safe;
- RChain has Byzantine safety or production liveness;
- one upstream unit test proves network-wide behavior.

The upstream issue explicitly warns that a naive relaxation can reintroduce the neighbouring C171 storm. A repair should therefore be evaluated against both the frozen-round liveness falsifier and a bounded-request/pace falsifier.

## Reproduce

The upstream execution performed by CI is:

```bash
cargo test -p rchain-node \
  a_round_that_comes_to_rest_at_one_height_is_sealed_by_its_own_bound \
  -- --nocapture
```

The resulting witness is then carried through:

```bash
npm run demo:rchain-c192 -- c192-witness.json c192-lattice-audit.json
npm run replay:lattice -- c192-lattice-audit.json
```
