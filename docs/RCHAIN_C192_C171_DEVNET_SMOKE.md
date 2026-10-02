# C192 / C171 controlled devnet smoke gate

This stage follows the green production-path wiring gate.

It uses the upstream n149 measurement machinery rather than inventing a separate network fixture:

- spec/audit/evidence/n149-sweep-run.sh
- spec/audit/evidence/n149-sample.py
- the same no-autopropose primary arm
- N=3 validators
- one deploy
- the same artifact semantics used by n149-summarise.py

The upstream revision remains pinned to 51935310789a1a75a183ad0af7152e4eef450c88.

## Two arms

Control:
- unmodified pinned upstream tree;
- N=3;
- attest-on-new-blocks enabled;
- no autopropose;
- expected to reproduce the C192 shape: one deploy-bearing round, all three validators observed, no finality in the smoke window.

Candidate:
- the same pinned tree plus the disposable production-path patch from the previous gate;
- identical devnet parameters;
- must finalize the deploy inside the smoke window.

Both images are built from host release binaries in the same job. The candidate build reuses the same Cargo target directory, so the second compile is incremental. The runtime image is a thin Debian trixie image matching the upstream Docker runtime.

## C171 smoke ceiling

The upstream audit explicitly warns that the old 126 and 276 figures may mix block count and height, so this gate does not use them as a threshold.

The first version of this smoke gate incorrectly paraphrased upstream's 12-16 figure as blocks/min. The upstream preregistration explicitly corrects it to **heights/min** (with roughly three blocks per height on the three-validator rig).

The numeric smoke boundary — 24 blocks/min, therefore 36 post-deploy blocks in the 90 second read window — was frozen before the first smoke run. It is retained unchanged here rather than moving the goalpost after candidate data was observed.

It must therefore be read only as a **pre-run CI smoke ceiling**. It is not a healthy-rate estimate, a protocol invariant, or C171 closure.

## PASS

PASS requires:
- the control arm is non-void and reproduces no-finality C192 within the window;
- the candidate arm is non-void;
- no failed block reads;
- no blocks in the no-autopropose idle window;
- exactly one deploy-bearing block;
- all three validators appear in the sampled/post-deploy evidence;
- the candidate finalizes the deploy;
- candidate post-deploy growth stays at or below the smoke ceiling.

If the control unexpectedly finalizes, the result is BLOCKED rather than PASS: the baseline did not reproduce, so the comparison is not interpretable.

## What PASS does not mean

A green smoke gate is not the full n149 protocol.

It does not replace:
- at least three unfiltered attempts;
- the original 180 second reading window;
- a separately preregistered C171 rate experiment with an explicit unit;
- live public-testnet observation;
- consensus-safety analysis.

It only earns the candidate permission to move to that heavier campaign.


## Observed green run

PR #33 completed the smoke gate successfully against the pinned upstream revision.

| Arm | Post-deploy blocks | Senders | Finality | Idle blocks | Failed block reads |
|---|---:|---:|---:|---:|---:|
| unmodified control | 3 | 3 | never in 90 s | 0 | 0 |
| disposable candidate | 12 | 3 | 3 s | 0 | 0 |

The control reproduced the registered C192 shape: one block from each validator and no finality.

The candidate crossed that boundary: it finalized the deploy in 3 seconds while producing 12 post-deploy blocks, below the frozen 36-block smoke ceiling.

This is one controlled attempt only. It is evidence that the production-path candidate is worth taking to the repeated campaign; it is not C192 closure, C171 closure, or a production-safety claim.

The first smoke execution is intentionally retained in the evidence history even though its evaluator returned BLOCKED. The network data were valid, but the evaluator counted only nodes with numeric finality and therefore reported `sampledNodes=0` on the no-finality control. The parser was corrected to count sampled nodes independently from finality, a regression test was added, and the next execution passed without changing the network acceptance boundary.
