#!/usr/bin/env python3
import subprocess
import sys
from pathlib import Path

PINNED = "51935310789a1a75a183ad0af7152e4eef450c88"

if len(sys.argv) != 2:
    raise SystemExit("usage: inject_rchain_attestation_cadence_off.py <upstream-dir>")

root = Path(sys.argv[1]).resolve()
revision = subprocess.check_output(
    ["git", "-C", str(root), "rev-parse", "HEAD"], text=True
).strip()
if revision != PINNED:
    raise SystemExit(f"unexpected upstream revision: {revision}")

path = root / "node/src/runtime/node_runtime.rs"
text = path.read_text(encoding="utf-8")

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

if new in text:
    print("cadence-off negative control already injected")
    raise SystemExit(0)

if old not in text:
    raise SystemExit(
        "production candidate cadence helper not found; apply "
        "inject_rchain_attestation_production_wiring.py first"
    )

text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
print(path)
