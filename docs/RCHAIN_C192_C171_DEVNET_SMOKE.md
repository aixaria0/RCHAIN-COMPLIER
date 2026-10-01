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

Instead, upstream separately records a healthy three-validator envelope of about 12-16 blocks/min. For CI smoke only, this gate uses 24 blocks/min: 1.5x the high end of that healthy envelope.

For the 90 second read window, the candidate ceiling is therefore 36 post-deploy blocks.

This number is deliberately labeled a CI smoke threshold. It is not a protocol invariant and it does not close C171.

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
