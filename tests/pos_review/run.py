"""Validate a conditional repair in a temporary upstream checkout; preserve raw results."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

PIN = "11b2200dcca580f2c00246302238840dcd4f08f6"
SOURCE_HASH = "2bb94d38a3c8e4cb69017f3e4f620ccc8b6c677e869862ce4c33c8e7f4d8204c"
checkout, output = map(lambda x: Path(x).resolve(), sys.argv[1:3])
output.mkdir(parents=True, exist_ok=True)
source = checkout / "rholang/src/native_state.rs"
fixture = checkout / "casper/tests/aria_pos_persistence.rs"
original = source.read_bytes()
report = {"source_sha": PIN, "runner_commit": os.getenv("GITHUB_SHA"),
          "run_id": os.getenv("GITHUB_RUN_ID"), "candidate_only": True,
          "policy": "conditional on documented pending-withdrawal cancellation",
          "network_verified": False, "targeted_casper_replay_verified": False,
          "checks": [], "complete": False}

def digest(data):
    return hashlib.sha256(data).hexdigest()

try:
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=checkout, text=True).strip()
    if head != PIN or subprocess.check_output(["git", "status", "--porcelain"], cwd=checkout):
        raise RuntimeError("expected clean pinned source")
    if digest(original) != SOURCE_HASH or fixture.exists():
        raise RuntimeError("source hash mismatch or existing fixture")
    start = original.index(b"    pub async fn slash(")
    stop = original.index(b"    pub async fn trust(", start)
    block = original[start:stop]
    anchor = b"        self.set_withdrawers(&withdrawers);\n"
    if block.count(anchor) != 1:
        raise RuntimeError("candidate anchor is ambiguous")
    changed = block.replace(anchor, anchor + b"        self.set_pending_withdrawers(&pending);\n")
    patched = original[:start] + changed + original[stop:]
    source.write_bytes(patched)
    fixture.write_bytes(Path(__file__).with_name("persistence.rs").read_bytes())
    report.update(original_source_sha256=digest(original), candidate_source_sha256=digest(patched))
    (output / "candidate.diff").write_text(subprocess.check_output(
        ["git", "diff", "--", "rholang/src/native_state.rs"], cwd=checkout, text=True))
    (output / "persistence.rs").write_bytes(fixture.read_bytes())
    (output / "Cargo.lock").write_bytes((checkout / "Cargo.lock").read_bytes())
    commands = [
        ("native-controls", ["cargo", "test", "--locked", "-p", "rchain-rholang", "--lib", "native_state::tests::"]),
        ("candidate-persistence", ["cargo", "test", "--locked", "-p", "rchain-casper", "--test", "aria_pos_persistence"]),
        ("runtime-controls", ["cargo", "test", "--locked", "-p", "rchain-casper", "--test", "determinism", "--test", "system_process_replies_and_restart"]),
    ]
    for name, args in commands:
        command = args + ["--", "--nocapture", "--test-threads=1"]
        with (output / f"{name}.log").open("w") as log:
            result = subprocess.run(command, cwd=checkout, stdout=log, stderr=subprocess.STDOUT)
        summaries = re.findall(r"test result: (\w+)\. (\d+) passed; (\d+) failed; (\d+) ignored", (output / f"{name}.log").read_text())
        passed = result.returncode == 0 and bool(summaries) and all(
            status == "ok" and int(n) > 0 and int(f) == 0 and int(i) == 0
            for status, n, f, i in summaries)
        report["checks"].append({"name": name, "command": command, "exit_code": result.returncode,
                                  "summaries": summaries, "passed": passed})
        print(json.dumps(report["checks"][-1]), flush=True)
        if not passed:
            raise RuntimeError(f"{name} failed; see raw log")
    report["complete"] = True
    report["targeted_casper_replay_verified"] = True
finally:
    source.write_bytes(original)
    if fixture.exists() and fixture.read_bytes() == Path(__file__).with_name("persistence.rs").read_bytes():
        fixture.unlink()
    report["source_restored"] = source.read_bytes() == original
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    manifest = {p.name: digest(p.read_bytes()) for p in sorted(output.iterdir()) if p.is_file() and p.name != "sha256.json"}
    (output / "sha256.json").write_text(json.dumps(manifest, indent=2) + "\n")
