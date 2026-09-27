# Reality Plane - Maintainer Loop

The Maintainer Loop is a small, fail-closed evidence layer for recurring RChain debugging work.

It targets a repeated pattern visible in recent `rchain-rust` and `quantum-os` work:

1. an operation reports success or a node appears healthy;
2. the semantic effect is unclear or wrong;
3. the maintainer manually reconstructs the real state;
4. replay, restart, merge, or a second observation narrows the failure;
5. a regression test and documentation update are produced.

The loop makes steps 1-4 machine-readable so the maintainer spends time on the semantic decision rather than evidence plumbing.

## Current scenarios

| ID | Purpose | Recent maintainer pattern |
|---|---|---|
| `MAINTAINER_HEALTH` | consume Sentinel's GET-only node/finality/Casper health packet | one-call maintainer brief across the current public RNode surface |
| `NODE_BOOT` | distinguish process-running from usable HTTP node | dependency/axum regression in rchain-rust PR #81 |
| `TRUST_BOND_ACTIVATE` | verify validator admission by semantic effect | silent PoS admission problem in issue #74 |
| `WITHDRAW_EPOCH` | verify pending-withdrawal to epoch-boundary transition | testnet behavior documented in PR #82 |
| `SLASH_PERSISTENCE` | verify every mutated native map is persisted | pending-withdrawal omission fixed in PR #78 |
| `NATIVE_MERGE` | verify native writes survive multi-parent merge | native-state loss fixed in PR #79 |
| `FINALITY_2V` | verify both validators participate and finality advances | work around #70/#80 |
| `TRANSFER_EFFECT` | confirm a transfer by balance effect, not return-slot assumptions | QuantumOS PR #237/#238 |
| `DOC_SNAPSHOT` | detect drift between live chain facts and documentation | testnet refresh in PR #82 |

These are bounded verification scenarios, not protocol-wide correctness claims.

## Key rule

**Transport success is evidence, not the verdict.**

A `ProcessedWithSuccess` result can coexist with a failed semantic effect. A process reaching `Running` can coexist with an unusable HTTP API. The loop therefore keeps transport, execution, semantic effect, replay, and final state as separate observations.

## CLI

List scenarios:

```bash
node scripts/maintainer-loop/cli.mjs --list
```

Evaluate a packet:

```bash
node scripts/maintainer-loop/cli.mjs \
  --scenario TRUST_BOND_ACTIVATE \
  --input scripts/maintainer-loop/fixtures/issue-74-silent-trust.json \
  --out /tmp/issue-74.reality.json
```

Exit codes are `0` for verified/consistent, `1` for concrete divergence, and `2` for insufficient evidence.

The generated artifact uses the existing `rchain-reality-record/v1` shape and records the first divergence explicitly.

## Repository split

`RCHAIN-COMPLIER` remains the evidence contract and evaluator. Live collection should come from `rchain-sentinel`, while the operator-facing view can remain in `rlsenti`.

The first live integration should stay read-only and low-risk:

1. Sentinel emits only what the current public RNode read surface actually establishes: node identity/version, network/shard, heights, finalized-block identity, canonical consistency, node-reported finality, bond structure, capabilities/shards, and cross-node agreement.
2. The Maintainer Loop evaluates `MAINTAINER_HEALTH` or another bounded scenario. Evidence that the public API does not expose (for example native trusted-set or pending-withdrawal maps) remains explicitly unavailable instead of being inferred.
3. The output becomes a sealed Reality Record.
4. `rlsenti` displays `FIRST DIVERGENCE`, evidence, source SHA, replay state, and a reproducible command.
5. Mutating testnet actions remain explicit maintainer-approved steps rather than automatic protocol actions.

The intended maintainer experience is:

```text
scenario: TRUST_BOND_ACTIVATE
transport: PASS
execution: PASS
semantic effect: FAIL
first divergence: trusted_contains_target
source: rchain-rust@<sha>
replay: REPRODUCED
artifact: <RealityRecord digest>
```

That is the boundary: automate evidence gathering and diagnosis plumbing; keep protocol semantics and deployment decisions with maintainers.


## Live Sentinel handoff

The companion `rchain-sentinel` branch exposes:

- `GET /maintainer` for the human one-screen brief;
- `GET /api/maintainer/brief` for the full observational bundle;
- `GET /api/maintainer/packet` for the exact packet consumed here.

A captured packet can be sealed immediately:

```bash
curl -fsS http://localhost:8080/api/maintainer/packet > /tmp/rchain-maintainer.json
node scripts/maintainer-loop/cli.mjs \
  --scenario MAINTAINER_HEALTH \
  --input /tmp/rchain-maintainer.json \
  --out /tmp/rchain-maintainer.reality.json
```

The first command is GET-only; the second performs local deterministic evaluation and Reality Record sealing.
