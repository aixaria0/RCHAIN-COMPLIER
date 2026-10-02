#!/usr/bin/env python3
import json
import sys
from pathlib import Path

EXPECTED_ATTEMPTS = 3
EXPECTED_NODES = 3

def read_marks(path):
    marks = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if "\t" in line:
            k, v = line.split("\t", 1)
            marks[k] = v
    return marks

def read_blocks(path):
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        t, num, sender, deploy_count, parents, block_hash = line.split("\t")
        rows.append({
            "epoch": int(t),
            "number": int(num),
            "sender": sender,
            "deploy_count": int(deploy_count),
            "parents": int(parents),
            "hash": block_hash,
        })
    return rows

def read_series(path):
    finalized_by_node = {}
    sampled_nodes = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#") or line.startswith("utc\t"):
            continue
        parts = line.split("\t")
        if len(parts) != 6:
            continue
        _utc, epoch, node, _height, finalized, _alive = parts
        sampled_nodes.add(node)
        if finalized.isdigit():
            finalized_by_node.setdefault(node, []).append((int(epoch), int(finalized)))
    return finalized_by_node, sampled_nodes

def time_to_finality(series, deploy_epoch, target):
    if not series:
        return None
    nodes = sorted(series)
    epochs = sorted({
        epoch for rows in series.values() for epoch, _finalized in rows
        if epoch >= deploy_epoch
    })
    for epoch in epochs:
        for node in nodes:
            vals = [
                finalized
                for sample_epoch, finalized in series[node]
                if deploy_epoch - 1 <= sample_epoch <= epoch
            ]
            if not vals or max(vals) < target:
                break
        else:
            return epoch - deploy_epoch
    return None

def resolve_sweep(root):
    root = Path(root)
    children = sorted(p for p in root.iterdir() if p.is_dir())
    if len(children) != 1:
        raise RuntimeError(
            f"expected exactly one sweep directory under {root}, found {len(children)}"
        )
    return children[0]

def summarize_attempt(run):
    void_file = run / "void.txt"
    if void_file.exists():
        return {
            "run": run.name,
            "void": True,
            "voidReason": void_file.read_text(encoding="utf-8").strip(),
        }

    required = ["marks.tsv", "blocks.tsv", "series.tsv"]
    missing = [name for name in required if not (run / name).exists()]
    if missing:
        return {
            "run": run.name,
            "void": True,
            "voidReason": "missing artifacts: " + ", ".join(missing),
        }

    marks = read_marks(run / "marks.tsv")
    blocks = read_blocks(run / "blocks.tsv")
    series, sampled_nodes = read_series(run / "series.tsv")

    deploy_epoch = int(marks["idle_end_and_deploy"])
    settle_end = int(marks["settle_end"])
    read_end = int(marks["read_end"])

    idle = [b for b in blocks if settle_end <= b["epoch"] < deploy_epoch]
    post = [b for b in blocks if b["epoch"] >= deploy_epoch]
    carriers = [b for b in post if b["deploy_count"] >= 1]
    target = carriers[0]["number"] if len(carriers) == 1 else None
    ttf = time_to_finality(series, deploy_epoch, target) if target is not None else None

    errors_file = run / "blocks-read-errors.txt"
    read_errors = 0
    if errors_file.exists():
        read_errors = sum(
            1
            for line in errors_file.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.startswith("#")
        )

    return {
        "run": run.name,
        "void": False,
        "idleBlocks": len(idle),
        "deployBearingBlocks": len(carriers),
        "postDeployBlocks": len(post),
        "senders": len({b["sender"] for b in post}),
        "sampledNodes": len(sampled_nodes),
        "maxParents": max((b["parents"] for b in post), default=0),
        "timeToFinalitySeconds": ttf,
        "blockReadErrors": read_errors,
        "readWindowSeconds": read_end - deploy_epoch,
    }

def summarize_arm(root):
    sweep = resolve_sweep(root)
    attempts = []
    for attempt in range(1, EXPECTED_ATTEMPTS + 1):
        run = sweep / f"n3-noauto-a{attempt}"
        if not run.exists():
            attempts.append({
                "run": run.name,
                "void": True,
                "voidReason": "missing attempt directory",
            })
        else:
            attempts.append(summarize_attempt(run))
    return {"sweep": str(sweep), "attempts": attempts}

def integrity_errors(attempt):
    errors = []
    if attempt.get("void"):
        return ["void: " + attempt.get("voidReason", "unknown")]
    if attempt["blockReadErrors"] != 0:
        errors.append(f"{attempt['blockReadErrors']} failed block reads")
    if attempt["idleBlocks"] != 0:
        errors.append(f"{attempt['idleBlocks']} idle-window blocks")
    if attempt["deployBearingBlocks"] != 1:
        errors.append(
            f"{attempt['deployBearingBlocks']} deploy-bearing blocks (expected 1)"
        )
    if attempt["senders"] != EXPECTED_NODES:
        errors.append(f"{attempt['senders']} senders (expected {EXPECTED_NODES})")
    if attempt["sampledNodes"] != EXPECTED_NODES:
        errors.append(
            f"{attempt['sampledNodes']} sampled nodes (expected {EXPECTED_NODES})"
        )
    if attempt["readWindowSeconds"] != 180:
        errors.append(
            f"{attempt['readWindowSeconds']} second read window (expected 180)"
        )
    return errors

def main():
    if len(sys.argv) not in (3, 4):
        raise SystemExit(
            "usage: evaluate_rchain_c192_repeated_campaign.py "
            "<control-root> <candidate-root> [output-json]"
        )

    control = summarize_arm(sys.argv[1])
    candidate = summarize_arm(sys.argv[2])

    blocked = []
    failed = []

    for i, attempt in enumerate(control["attempts"], 1):
        errs = integrity_errors(attempt)
        if errs:
            blocked.append(f"control attempt {i}: " + "; ".join(errs))
            continue
        if attempt["timeToFinalitySeconds"] is not None:
            blocked.append(
                f"control attempt {i}: baseline no longer reproduces C192; "
                f"finality={attempt['timeToFinalitySeconds']}s"
            )

    for i, attempt in enumerate(candidate["attempts"], 1):
        errs = integrity_errors(attempt)
        if errs:
            failed.append(f"candidate attempt {i}: " + "; ".join(errs))
            continue
        if attempt["timeToFinalitySeconds"] is None:
            failed.append(
                f"candidate attempt {i}: deploy did not finalize within 180s"
            )

    status = "BLOCKED" if blocked else ("FAIL" if failed else "PASS")

    report = {
        "schema": "rchain-c192-repeated-campaign/v1",
        "status": status,
        "upstreamRevision": "51935310789a1a75a183ad0af7152e4eef450c88",
        "protocol": {
            "validators": 3,
            "attemptsPerArm": EXPECTED_ATTEMPTS,
            "settleSeconds": 60,
            "idleSeconds": 60,
            "readSeconds": 180,
            "autopropose": False,
            "exactlyOneDeploy": True,
        },
        "control": control,
        "candidate": candidate,
        "blockedReasons": blocked,
        "failureReasons": failed,
        "c171ObservationOnly": {
            "quantity": "distinct post-deploy block hashes in each 180-second reading window",
            "control": [
                a.get("postDeployBlocks")
                for a in control["attempts"]
                if not a.get("void")
            ],
            "candidate": [
                a.get("postDeployBlocks")
                for a in candidate["attempts"]
                if not a.get("void")
            ],
            "verdict": "not evaluated by this gate",
            "reason": (
                "C171 requires a separately preregistered rate experiment with an explicit "
                "unit and a cadence-negative control; this campaign records the block counts "
                "without converting them into a C171 pass/fail claim."
            ),
        },
        "claimBoundary": [
            "PASS means the pinned control reproduced C192 in all three attempts and the disposable candidate finalized in all three attempts under the same N=3 60/60/180 rig.",
            "PASS does not close C171.",
            "PASS does not establish Byzantine safety, hard-fork neutrality, public-testnet behavior, or production readiness.",
            "No upstream change is made by this campaign.",
        ],
    }

    encoded = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if len(sys.argv) == 4:
        Path(sys.argv[3]).write_text(encoded, encoding="utf-8")
    print(encoded, end="")

    if status == "BLOCKED":
        raise SystemExit(2)
    if status == "FAIL":
        raise SystemExit(1)

if __name__ == "__main__":
    main()
