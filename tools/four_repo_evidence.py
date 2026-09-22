#!/usr/bin/env python3
"""Run exact pinned source tests and aggregate four distinct evidence records.

Evidence of executing each repository's source-level test scope is not evidence
of shared protocol semantics, live connectivity, or network consensus safety.
"""
import argparse
import hashlib
import json
import pathlib
import subprocess
import sys

SCHEMA = "aria-four-repo-execution/v1"
SOURCES = {
    "cbc": {
        "repository": "aixaria0/RCHAIN-COMPLIER",
        "sha": "2d2c3d879b1a078693c8551385efb54a811d7172",
        "scope": "synthetic CBC replay, upstream-anchored M26 observation and bounded M27 witness search tests; not a live network test",
        "command": ["node", "--experimental-strip-types", "--test",
                    "src/lib/cbc/cbc-simulator.test.ts",
                    "src/lib/cbc/casper-cbc-upstream-replay.test.ts",
                    "src/lib/cbc/casper-reachable-adversarial-history-search.test.ts"],
    },
    "workbench": {
        "repository": "aixaria0/rlsenti",
        "sha": "00e1ed1b30a1779f72c59c0505467da60080a365",
        "scope": "deterministic compiler/exchange/observation regression tests (synthetic)",
        "command": ["node", "--experimental-strip-types", "--test",
                    "src/lib/compiler/compiler.test.ts"],
    },
    "lattice": {
        "repository": "aixaria0/Sovereign-Lattice",
        "sha": "e141e89e5ff158c0eba375448b8839bf7859fef5",
        "scope": "independent PBFT adversarial-scheduler test, not Casper CBC",
        "command": ["cargo", "test", "--manifest-path",
                    "rust_engine/Cargo.toml", "--test", "adversarial_scheduler"],
        "lockfile": "rust_engine/Cargo.lock",
    },
    "sentinel": {
        "repository": "aixaria0/rchain-sentinel",
        "sha": "7823bac56f8dd845d9b9f9e7c50982b49decdcc2",
        "scope": "Sentinel evidence inventory and external M27 offline inspector unit tests; neither independently proves finality",
        "command": ["cargo", "test", "--manifest-path",
                    "backend/Cargo.toml"],
        "lockfile": "backend/Cargo.lock",
    },
}
LIMITS = [
    "Four real source test scopes; no cross-repository runtime wiring or shared-CBC-fixture conformance yet.",
    "rlsenti workbench and CBC simulator execute deterministic synthetic fixtures.",
    "Sovereign-Lattice PBFT safety tests do not establish RChain Casper CBC safety.",
    "Sentinel Casper evidence inventory is not an independent stake-weighted finality proof.",
    "No live RNode connection, live network exploit, throughput or superiority claim.",
]


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def digest(value):
    return hashlib.sha256(value).hexdigest()


def sealed(value):
    return {**value, "record_sha256": digest(canonical(value))}


def verify_seal(value):
    if not isinstance(value, dict) or "record_sha256" not in value:
        raise ValueError("Missing signed-by-content record field")
    body = {k: v for k, v in value.items() if k != "record_sha256"}
    if value["record_sha256"] != digest(canonical(body)):
        raise ValueError("Record digest does not match content")


def git_head(source_dir):
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"], cwd=source_dir,
        capture_output=True, text=True, timeout=20, check=True,
    )
    return result.stdout.strip()


def capture(component, source_dir, out_dir, timeout=900):
    """Run actual code checked out at an exact Git SHA, never a stub."""
    if component not in SOURCES:
        raise ValueError("Unknown component: " + component)
    spec = SOURCES[component]
    source_dir = pathlib.Path(source_dir).resolve()
    if not (source_dir / ".git").exists():
        raise ValueError("Expected a Git checkout: " + str(source_dir))
    actual_sha = git_head(source_dir)
    if actual_sha != spec["sha"]:
        raise ValueError("Pinned SHA mismatch for " + component + ": " + actual_sha)
    source_lock = (source_dir / spec["lockfile"]).read_bytes() if "lockfile" in spec else None
    result = subprocess.run(
        spec["command"], cwd=source_dir, capture_output=True,
        timeout=timeout, check=False,
    )
    out_dir = pathlib.Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "stdout.log").write_bytes(result.stdout)
    (out_dir / "stderr.log").write_bytes(result.stderr)
    lockfile = None
    if "lockfile" in spec:
        effective_lock = (source_dir / spec["lockfile"]).read_bytes()
        (out_dir / "source-Cargo.lock").write_bytes(source_lock)
        (out_dir / "effective-Cargo.lock").write_bytes(effective_lock)
        lockfile = {"path": spec["lockfile"],
                    "source_sha256": digest(source_lock),
                    "effective_sha256": digest(effective_lock),
                    "modified_by_cargo": source_lock != effective_lock}
    content = {
        "schema": SCHEMA,
        "component": component,
        "repository": spec["repository"],
        "source_sha": actual_sha,
        "scope": spec["scope"],
        "command": spec["command"],
        "exit_code": result.returncode,
        "stdout_sha256": digest(result.stdout),
        "stderr_sha256": digest(result.stderr),
        "stdout_bytes": len(result.stdout),
        "stderr_bytes": len(result.stderr),
        "evidence_kind": "source-test-execution",
        "live_network": False,
        "interoperability_verified": False,
        "dependency_lockfile": lockfile,
    }
    record = sealed(content)
    (out_dir / "record.json").write_text(
        json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return record


def combine(input_dir, output_path):
    """Fail closed for absent, modified, foreign or failed evidence."""
    input_dir = pathlib.Path(input_dir)
    records = []
    for component, spec in sorted(SOURCES.items()):
        path = input_dir / ("component-" + component) / "record.json"
        record = json.loads(path.read_text(encoding="utf-8"))
        verify_seal(record)
        expected = {
            "schema": SCHEMA,
            "component": component,
            "repository": spec["repository"],
            "source_sha": spec["sha"],
            "scope": spec["scope"],
            "command": spec["command"],
            "evidence_kind": "source-test-execution",
            "live_network": False,
            "interoperability_verified": False,
            "exit_code": 0,
        }
        for key, value in expected.items():
            if record.get(key) != value:
                raise ValueError("Wrong " + key + " in " + component)
        component_dir = input_dir / ("component-" + component)
        for name in ("stdout", "stderr"):
            blob = (component_dir / (name + ".log")).read_bytes()
            if digest(blob) != record[name + "_sha256"] or len(blob) != record[name + "_bytes"]:
                raise ValueError("Tampered " + name + " for " + component)
        lock = record.get("dependency_lockfile")
        if "lockfile" in spec:
            if not isinstance(lock, dict) or lock.get("path") != spec["lockfile"]:
                raise ValueError("Missing or mismatched lockfile metadata for " + component)
            before = (component_dir / "source-Cargo.lock").read_bytes()
            after = (component_dir / "effective-Cargo.lock").read_bytes()
            if (digest(before) != lock.get("source_sha256")
                or digest(after) != lock.get("effective_sha256")
                or (before != after) != lock.get("modified_by_cargo")):
                raise ValueError("Tampered dependency lockfile for " + component)
        elif lock is not None:
            raise ValueError("Unexpected dependency lockfile for " + component)
        records.append(record)
    report = sealed({
        "schema": "aria-four-repo-bundle/v1",
        "entries": records,
        "components_passed": len(records),
        "limits": LIMITS,
    })
    output_path = pathlib.Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n",
                           encoding="utf-8")
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    command = parser.add_subparsers(dest="action", required=True)
    run = command.add_parser("capture", help="Run one source test scope at its pinned Git commit")
    run.add_argument("--component", choices=sorted(SOURCES), required=True)
    run.add_argument("--source-dir", required=True)
    run.add_argument("--out-dir", required=True)
    aggregate = command.add_parser("combine", help="Check four records and seal their evidence bundle")
    aggregate.add_argument("--input-dir", required=True)
    aggregate.add_argument("--output", required=True)
    args = parser.parse_args(argv)
    try:
        if args.action == "capture":
            report = capture(args.component, args.source_dir, args.out_dir)
            print(args.component + ": source=" + report["source_sha"] +
                  ", exit=" + str(report["exit_code"]) +
                  ", record_sha256=" + report["record_sha256"])
            return 0 if report["exit_code"] == 0 else 1
        report = combine(args.input_dir, args.output)
        print("bundle: " + str(report["components_passed"]) +
              " pinned source-test records; digest=" + report["record_sha256"])
        return 0
    except (ValueError, OSError, subprocess.SubprocessError, json.JSONDecodeError) as error:
        print("four-repo evidence error: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
