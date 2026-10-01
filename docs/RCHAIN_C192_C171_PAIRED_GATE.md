# C192 / C171 paired repair gate

This is the next step after the merged C192 live-witness integration in PR #28.

It does **not** modify `rchain-rust`. Its job is to reject repair families that solve only one side of the attestation problem before any candidate is injected into an upstream checkout.

## Why the two findings must be evaluated together

The current upstream tap in `node/src/runtime/node_runtime.rs` answers a remote block only when its height is strictly greater than the last remote height answered.

That gives one useful bound and one failure:

- same-height fan-out is collapsed to one request;
- a round that comes to rest at one height can never create the next request.

Relaxing `>` to `>=` opens the C192 path by feeding more proposal requests, but it does so by restoring the same-height fan-out that C171 needs bounded.

The existing tip-relative pace rule is also insufficient by itself. If the tip is frozen at the same height as this node's latest message, the node never becomes more heights behind the tip, so a tip-relative quiet condition cannot wake that round.

## Candidate families

| Candidate | C192 rested-round liveness | C171 same-height bound | C171 advancing-rate bound | Paired gate |
|---|---:|---:|---:|---:|
| current per-height | fail | pass | fail | reject |
| naive same-height relaxation | conditional | fail | fail | reject |
| pace only | fail | pass | pass | reject |
| paced + designated local escape | pass in abstract model | pass | pass | admit for upstream injection |

The admitted candidate is still only a **design family**, not a patch.

It assumes:

1. ordinary remote-triggered attestations are pace-gated;
2. a stalled round has exactly one deterministic escape owner;
3. that owner has a node-local trigger that continues even when no new remote height arrives;
4. the local escape is bounded to the proposer's existing `LIVENESS_WINDOW + 1` attempt budget.

This makes the candidate's request budget independent of the number of same-height peer blocks.

## Why designated ownership matters

If every validator independently self-drives the stalled round, the local escape itself can become a new fan-out source.

So the model admits only a single deterministic escape owner per round-equivalent key.

The evaluator deliberately does not choose the key or selector. Those details must come from state the real node can derive consistently.

## What this gate proves

Only this:

> A candidate family preserves the two abstract invariants represented by C192 and C171 better than the known-bad alternatives.

It does not prove:

- the candidate is implementable at the current tap call-site;
- the round key is consensus-safe;
- the designated selector is correct;
- the multi-validator devnet finalises;
- block rate is production-safe;
- Issue #172 or #149 is fixed.

## Next boundary

The next step after this gate is an **injected upstream prototype** on a pinned `rchain-rust` checkout.

That prototype must run at least:

1. the existing C192 sequence falsifier;
2. a C171 pace/burst falsifier;
3. the relevant proposer round/escape tests;
4. only after those pass, the controlled three-validator devnet arms with block count and time-to-finality measured together.

No upstream branch should be changed before a candidate passes that injected gate.
