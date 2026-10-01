#!/usr/bin/env python3
import hashlib
import json
import subprocess
import sys
from pathlib import Path

EXPECTED_REVISION = "51935310789a1a75a183ad0af7152e4eef450c88"

if len(sys.argv) != 3:
    raise SystemExit("usage: check_rchain_attestation_pair_seam.py <upstream-dir> <output-json>")

root = Path(sys.argv[1]).resolve()
output = Path(sys.argv[2]).resolve()
revision = subprocess.check_output(
    ["git", "-C", str(root), "rev-parse", "HEAD"], text=True
).strip()
if revision != EXPECTED_REVISION:
    raise SystemExit(f"unexpected upstream revision: {revision}")

paths = {
    "runtime": root / "node/src/runtime/node_runtime.rs",
    "proposer": root / "casper/src/blocks/proposer/proposer.rs",
    "message_state": root / "block-storage/src/dag/message_state.rs",
}
texts = {name: path.read_text(encoding="utf-8") for name, path in paths.items()}

checks = {
    "strict_remote_height_bound": "last_attested_height.map_or(true, |last| height > last)" in texts["runtime"],
    "c192_sequence_falsifier": "a_round_that_comes_to_rest_at_one_height_is_sealed_by_its_own_bound" in texts["runtime"],
    "own_quiet_cadence": (
        "fn cadence_due" in texts["proposer"]
        and "heights_behind(tip, mine.block_num) > liveness::LIVENESS_WINDOW" in texts["proposer"]
    ),
    "bounded_proposer_escape": (
        "has_advanced_past_the_round" in texts["proposer"]
        and "if waited <= LIVENESS_WINDOW" in texts["proposer"]
    ),
    "deterministic_round_boundary": "pub round_parents:" in texts["message_state"],
    "round_advance_signal": "pub fn has_advanced_past_the_round" in texts["message_state"],
    "existing_escape_parent_set": "pub fn parents_for_new_block_escaping" in texts["message_state"],
}
failed = [name for name, value in checks.items() if not value]
if failed:
    raise SystemExit("upstream attestation seam drifted: " + ", ".join(failed))

def digest(path: Path) -> str:
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()

payload = {
    "schema": "rchain-attestation-seam/v1",
    "repository": "rchain-community/rchain-rust",
    "revision": revision,
    "checks": checks,
    "digests": {name: digest(path) for name, path in paths.items()},
    "claim": (
        "The pinned upstream revision still exposes the strict per-height tap, the C192 sequence "
        "falsifier, own-quiet cadence, and deterministic round/escape state used by the paired evaluator."
    ),
}
output.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
print(json.dumps(payload, indent=2, sort_keys=True))
