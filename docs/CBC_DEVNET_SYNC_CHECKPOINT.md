# Two-validator devnet sync: internal evidence checkpoint

Date: 2026-09-25. This checkpoint supports the ongoing Casper/PoS review; it
is not the final maintainer report.

## Result and exact scope

The upstream [genesis replay correction](https://github.com/rchain-community/rchain-rust/commit/11b2200dcca580f2c00246302238840dcd4f08f6)
was built **without Rust modifications** at
`11b2200dcca580f2c00246302238840dcd4f08f6`. Two throwaway validators
received the same genesis bonds and wallet configuration. With 80/20 stake,
manual proposals, and the upstream dev-mode signed `Nil` deploy, each validator
created three ordinary blocks. Every proposed block was retrieved with identical
metadata from the other node before the next proposal. Both nodes reached tip
height 7 and explicitly reported the same block #2 as finalized, with matching
block and post-state hashes **within each execution**.

| Run | Harness commit | Outcome | Finalized #2 | Post-state | Artifact SHA-256 |
| --- | --- | --- | --- | --- | --- |
| [36094971145, attempt 1](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/36094971145/artifacts/10846922754) | `7a78177a424806f5b3d74ec20058dcc9b64e1ba1` | PASS, 6 blocks | `4c118a175c965b05effc59a67113ea331d6d8c7c4d469b2f9d7e6833b07d1b79` | `d06645fabf110cf7a5f51b99ad4893a265496d838a3d51197bcbb4468c92048d` | `58468e83a785970760891773b13b54a4d513a0c185b491354fc16541bab7c00d` |
| [36096318509](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/36096318509/artifacts/10846948382) | `9b2236bbfc791936f60b5ab1e493816fd6b92b02` | PASS, 6 blocks | `f908cacca1f3f7c6896cde17fd9dc97804545cc1cd33f72f0465568416d12367` | `d06645fabf110cf7a5f51b99ad4893a265496d838a3d51197bcbb4468c92048d` | `7b73ad56adcd73062d6634082afecccab87f49724a6a7b5f6ee72ed3d900b534` |

Both downloaded ZIPs matched their GitHub artifact SHA-256 digests. In each ZIP,
all 97 files listed in `sha256.json` matched their individual hashes. Raw
`/api/last-finalized-block` responses agreed within each run, and two separate
`/api/is-finalized/<hash>` responses returned JSON `true`. Different block
hashes across runs are expected here: the upstream dev-mode signed `Nil` deploy
uses a current timestamp. Identical post-state hashes across these runs are a
useful observation, not a universal determinism proof.

## Failures and corrections retained

- [36092895016](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/36092895016)
  reached connected nodes but the initial harness incorrectly required a
  finalized fringe before the first proposal. The `400` response was not a
  genesis replay failure. Startup now checks the indexed genesis block instead;
  finality is still required at the end.
- [36094971145, attempt 2](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/36094971145/artifacts/10847312427)
  experienced a reset of the joining node's first status connection during
  startup. Its artifact has 40 verified file hashes and no proposals. The
  bounded startup retry was added and regression checked before run 36096318509.

The upstream C46 repair itself is not a new finding of this research. These
tests provide the missing two-validator end-to-end observation for that pinned
repair and a working normal-network baseline for further review. They do not
establish behavior on another topology, old RChain mainnet, or signed slashing.

## Separate native PoS observation still under review

The earlier [native lifecycle run](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/36043123111)
at upstream `0ac5498fe246ea8a901c9e5277383f672ed9635d` observed nine of nine
withdrawal requests persisting after `slash`; its original source passed three
controls and failed two lifecycle assertions. A research-only one-line candidate
passed five tests, but no production change was applied. A separate actual
`RuntimeManager` play/replay test observed the same pending state across tested
heights. None of those executions reached the signed peer consensus boundary.

The blob SHA of `rholang/src/native_state.rs` is
`8203db21a128600b7762a20bd36fee5d9d7c3c18` at the original native-test
pin, at the two-node test pin, and at upstream `04949a1ca9f2b41cfc2d7d67c786a09224acf2c4`.
Its `slash` function removes the pending entry from an in-memory map but does
not write that map back. This establishes continued source identity, not a new
execution of the lifecycle at the later pins. The intended policy after a
slash followed by rebonding remains a consensus/design question: the Rust
comment promises cancellation whereas the bundled `Pos.rhox` leaves pending
withdrawal state until its epoch processing. The final maintainer report must
keep source inconsistency, observed native behavior and network finality as
separate claims.
