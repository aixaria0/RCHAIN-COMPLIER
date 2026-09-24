"""Deterministic offline source-test injection and counterfactual; production tree is not committed."""
from pathlib import Path
import sys

PIN = "dfdce49473f452a9e968c33e7569014d597b2866"
target = Path("upstream-rchain/rholang/src/native_state.rs")
probe = Path("scripts/upstream/casper-slashing-persistence-probe.rs")

def replace_exact(s: str, old: str, new: str) -> str:
    if s.count(old) != 1:
        raise SystemExit(f"FAIL CLOSED: expected one upstream anchor, found {s.count(old)}: {old[:60]!r}")
    return s.replace(old, new, 1)

def inject() -> None:
    s = target.read_text()
    if not s.rstrip().endswith("}"):
        raise SystemExit("FAIL CLOSED: upstream test module terminator not found")
    start, end = s.rsplit("}", 1)
    if end.strip() != "":
        raise SystemExit("FAIL CLOSED: unexpected suffix")
    if "mod tests {" not in start or "pub async fn slash(" not in start:
        raise SystemExit("FAIL CLOSED: upstream implementation or test module missing")
    target.write_text(start + "\n" + probe.read_text() + "\n}\n")

def shadow() -> None:
    s = target.read_text()
    s = replace_exact(s,
        "        pending.remove(validator);\n        if let Some(stake) = stake {",
        "        pending.remove(validator);\n"
        "        let mut committed = self.committed_rewards().await?;\n"
        "        committed.remove(validator);\n"
        "        if let Some(stake) = stake {")
    s = replace_exact(s,
        "        self.set_withdrawers(&withdrawers);\n        Ok(Ok(()))\n    }\n\n    /// Admit",
        "        self.set_withdrawers(&withdrawers);\n"
        "        self.set_pending_withdrawers(&pending);\n"
        "        self.set_committed_rewards(&committed);\n"
        "        Ok(Ok(()))\n    }\n\n    /// Admit")
    target.write_text(s)

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ("inject", "shadow"):
        raise SystemExit("usage: casper-slashing-persistence-runner.py inject|shadow")
    {"inject": inject, "shadow": shadow}[sys.argv[1]]()
