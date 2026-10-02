#!/usr/bin/env python3
"""Disposable, reversible diagnostic trace; never a production repair."""
import subprocess
import sys
from pathlib import Path

PINNED = "51935310789a1a75a183ad0af7152e4eef450c88"
TAG = "C171_TRACE_V1"

# Each replacement retains its original text. Removing the exact inserted
# fragments must recover the candidate byte-for-byte, including short-circuit
# evaluation, lock scopes, state writes and queue-failure rollback.
INSERTIONS = [
    ("                let sender = block.sender.as_bytes().to_vec();\n",
     '                let trace_block = block.block_hash.to_hex();\n'),
    ("                    let remote_due = {\n",
     "                    let trace_last_height;\n"),
    ("                        if attest_warranted(&me, &sender, height, *last)\n",
     "                        trace_last_height = *last;\n"),
    ("                    if !remote_due && !self_due {\n", r'''                    tap_log.warn(
                        LogSource::new("coop.rchain.node.runtime.Setup"),
                        &format!("C171_TRACE_V1 phase=decision block={} height={} own={} round={} tip={} strict={} cadence={} remote={} self={}",
                            trace_block, height, own_latest_height.unwrap_or(-1), round_height, tip_height,
                            attest_warranted(&me, &sender, height, trace_last_height),
                            attestation_cadence_due(height, own_latest_height), remote_due, self_due),
                    );
'''),
]
FAILED_ANCHOR = "                        if self_due {\n"
FAILED_TRACE = r'''                        tap_log.warn(
                            LogSource::new("coop.rchain.node.runtime.Setup"),
                            &format!("C171_TRACE_V1 phase=queue block={} height={} outcome=rejected", trace_block, height),
                        );
'''
SUCCESS_ANCHOR = '''                            &format!(
                                "attest request not queued ({e}) — this validator will not attest to the new block"
                            ),
                        );
                    }
'''
SUCCESS_REPLACEMENT = SUCCESS_ANCHOR[:-len("                    }\n")] + r'''                    } else {
                        tap_log.warn(
                            LogSource::new("coop.rchain.node.runtime.Setup"),
                            &format!("C171_TRACE_V1 phase=queue block={} height={} outcome=accepted", trace_block, height),
                        );
                    }
'''


def rewrite(text):
    if TAG in text:
        raise ValueError("trace already present; require a clean candidate")
    if "fn stalled_round_self_trigger_warranted(" not in text:
        raise ValueError("production candidate must be injected first")
    result = text
    for anchor, snippet in INSERTIONS:
        if result.count(anchor) != 1:
            raise ValueError("trace anchor absent or ambiguous: " + anchor.strip())
        result = result.replace(anchor, snippet + anchor, 1)
    if result.count(FAILED_ANCHOR) != 1 or result.count(SUCCESS_ANCHOR) != 1:
        raise ValueError("queue outcome anchor absent or ambiguous")
    result = result.replace(FAILED_ANCHOR, FAILED_TRACE + FAILED_ANCHOR, 1)
    result = result.replace(SUCCESS_ANCHOR, SUCCESS_REPLACEMENT, 1)
    if untrace(result) != text:
        raise ValueError("trace reversibility check failed")
    return result


def untrace(text):
    result = text.replace(SUCCESS_REPLACEMENT, SUCCESS_ANCHOR, 1)
    result = result.replace(FAILED_TRACE, "", 1)
    for _anchor, snippet in reversed(INSERTIONS):
        if snippet:
            result = result.replace(snippet, "", 1)
    return result


def main():
    root = Path(sys.argv[1]).resolve()
    rev = subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip()
    if rev != PINNED:
        raise SystemExit("unexpected upstream revision: " + rev)
    path = root / "node/src/runtime/node_runtime.rs"
    path.write_text(rewrite(path.read_text(encoding="utf-8")), encoding="utf-8")


if __name__ == "__main__":
    main()
