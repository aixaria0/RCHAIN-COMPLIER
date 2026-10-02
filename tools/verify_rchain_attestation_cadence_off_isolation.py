#!/usr/bin/env python3
import difflib
import sys
from pathlib import Path

if len(sys.argv) != 3:
    raise SystemExit(
        "usage: verify_rchain_attestation_cadence_off_isolation.py "
        "<candidate-node_runtime.rs> <cadence-off-node_runtime.rs>"
    )

before_path = Path(sys.argv[1])
after_path = Path(sys.argv[2])
before = before_path.read_text(encoding="utf-8")
after = after_path.read_text(encoding="utf-8")

old = r'''fn attestation_cadence_due(height: i64, own_latest_height: Option<i64>) -> bool {
    own_latest_height.map_or(true, |mine| {
        height - mine > rchain_block_storage::dag::liveness::LIVENESS_WINDOW
    })
}
'''

new = r'''fn attestation_cadence_due(height: i64, own_latest_height: Option<i64>) -> bool {
    let _ = (height, own_latest_height);
    true
}
'''

if before.count(old) != 1:
    raise SystemExit(
        f"candidate must contain the production cadence helper exactly once; "
        f"found {before.count(old)}"
    )

if new in before:
    raise SystemExit("candidate already contains the cadence-off helper")

expected = before.replace(old, new, 1)

if after != expected:
    diff = "".join(
        difflib.unified_diff(
            expected.splitlines(keepends=True),
            after.splitlines(keepends=True),
            fromfile="expected-cadence-off",
            tofile="actual-cadence-off",
        )
    )
    raise SystemExit(
        "cadence-off isolation violated: the negative control changed more than "
        "the preregistered cadence helper\n" + diff[:12000]
    )

if after.count(new) != 1 or old in after:
    raise SystemExit("cadence-off helper replacement is not exact")

print("verified: cadence-off negative control changes exactly one helper")
