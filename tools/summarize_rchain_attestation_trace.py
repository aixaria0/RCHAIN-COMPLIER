#!/usr/bin/env python3
"""Summarize callback observations; COMPLETE is instrumentation, not C171 PASS."""
import collections
import json
import re
import sys
from pathlib import Path

from evaluate_rchain_c192_repeated_campaign import summarize_attempt, integrity_errors

TAG = "C171_TRACE_V1 "
BOOL = {"true": True, "false": False}
NODES = ("bootstrap", "validator-1", "validator-2")


def summarize_node(path):
    decisions, outcomes = [], []
    for line in path.read_text(encoding="utf-8").splitlines():
        if TAG not in line:
            continue
        payload = line.split(TAG, 1)[1]
        fields = dict(re.findall(r"(\w+)=([^\s]+)", payload))
        phase = fields.get("phase")
        required = ({"phase", "block", "height", "own", "round", "tip", "strict", "cadence", "remote", "self"}
                    if phase == "decision" else {"phase", "block", "height", "outcome"})
        if phase not in ("decision", "queue") or set(fields) != required:
            raise ValueError("malformed trace record in " + str(path))
        for name in ("height", "own", "round", "tip"):
            if name in fields:
                fields[name] = int(fields[name])
        if phase == "decision":
            for name in ("strict", "cadence", "remote", "self"):
                fields[name] = BOOL[fields[name]]
            if fields["remote"] != (fields["strict"] and fields["cadence"]):
                raise ValueError("inconsistent remote predicate trace")
            decisions.append(fields)
        else:
            if fields["outcome"] not in ("accepted", "rejected"):
                raise ValueError("unknown queue outcome")
            outcomes.append(fields)
    eligible = collections.Counter((d["block"], d["height"]) for d in decisions if d["remote"] or d["self"])
    queued = collections.Counter((d["block"], d["height"]) for d in outcomes)
    errors = []
    if not decisions:
        errors.append("no decision observations")
    if eligible != queued:
        errors.append("queue outcomes do not match admitted decisions")
    return {
        "decisionCount": len(decisions),
        "strictEligible": sum(d["strict"] for d in decisions),
        "cadenceSuppressedStrictEligible": sum(d["strict"] and not d["cadence"] for d in decisions),
        "remoteDue": sum(d["remote"] for d in decisions),
        "selfDue": sum(d["self"] for d in decisions),
        "selfDueWithCadenceFalse": sum(d["self"] and not d["cadence"] for d in decisions),
        "queueAccepted": sum(d["outcome"] == "accepted" for d in outcomes),
        "queueRejected": sum(d["outcome"] == "rejected" for d in outcomes),
        "errors": errors,
        "decisions": decisions,
        "queueOutcomes": outcomes,
    }


def summarize(root):
    attempts = sorted(Path(root).glob("*/n3-noauto-a*"))
    errors, rows = [], []
    if len(attempts) != 1:
        errors.append("expected exactly one diagnostic attempt per arm")
    for attempt in attempts:
        nodes = {}
        for node in NODES:
            path = attempt / f"logs-devnet-{node}.txt"
            try:
                nodes[node] = summarize_node(path)
                errors.extend(f"{attempt.name}/{node}: {e}" for e in nodes[node]["errors"])
            except (OSError, ValueError, KeyError) as exc:
                errors.append(f"{attempt.name}/{node}: {exc}")
        if (attempt / "void.txt").exists():
            errors.append(attempt.name + ": void network attempt")
        try:
            network = summarize_attempt(attempt)
            errors.extend(attempt.name + ": " + e for e in integrity_errors(network))
        except (OSError, ValueError, KeyError) as exc:
            network = None
            errors.append(attempt.name + ": " + str(exc))
        rows.append({"run": attempt.name, "nodes": nodes, "networkObservation": network})
    return {"attempts": rows, "errors": errors}


def main():
    arms = {"candidate": summarize(sys.argv[1]), "cadenceOff": summarize(sys.argv[2])}
    report = {"schema": "rchain-c171-callback-diagnostic/v1", "arms": arms,
              "status": "BLOCKED" if any(a["errors"] for a in arms.values()) else "COMPLETE",
              "claimBoundary": "Callback and queue-admission observations only; no C171 acceptance or proposer-completion claim. Tracing may perturb timing."}
    encoded = json.dumps(report, indent=2, sort_keys=True) + "\n"
    Path(sys.argv[3]).write_text(encoded, encoding="utf-8")
    print(encoded, end="")
    if report["status"] != "COMPLETE":
        raise SystemExit(2)


if __name__ == "__main__":
    main()
