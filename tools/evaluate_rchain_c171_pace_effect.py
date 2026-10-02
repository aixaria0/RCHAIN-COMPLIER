#!/usr/bin/env python3
import json
import sys
from pathlib import Path

ATTEMPTS = 3
NODES = 3

def read_marks(path):
    out = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if "\t" in line:
            k, v = line.split("\t", 1)
            out[k] = v
    return out

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
    finalized = {}
    sampled = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#") or line.startswith("utc\t"):
            continue
        parts = line.split("\t")
        if len(parts) != 6:
            continue
        _utc, epoch, node, _height, fin, _alive = parts
        sampled.add(node)
        if fin.isdigit():
            finalized.setdefault(node, []).append((int(epoch), int(fin)))
    return finalized, sampled

def ttf(series, deploy_epoch, target):
    if not series:
        return None
    nodes = sorted(series)
    epochs = sorted({
        e for rows in series.values() for e, _f in rows if e >= deploy_epoch
    })
    for epoch in epochs:
        for node in nodes:
            values = [
                f for sample_epoch, f in series[node]
                if deploy_epoch - 1 <= sample_epoch <= epoch
            ]
            if not values or max(values) < target:
                break
        else:
            return epoch - deploy_epoch
    return None

def resolve(root):
    root = Path(root)
    children = sorted(p for p in root.iterdir() if p.is_dir())
    if len(children) != 1:
        raise RuntimeError(
            f"expected exactly one sweep directory under {root}, found {len(children)}"
        )
    return children[0]

def attempt(run):
    void = run / "void.txt"
    if void.exists():
        return {
            "run": run.name,
            "void": True,
            "voidReason": void.read_text(encoding="utf-8").strip(),
        }

    marks = read_marks(run / "marks.tsv")
    blocks = read_blocks(run / "blocks.tsv")
    series, sampled = read_series(run / "series.tsv")

    deploy = int(marks["idle_end_and_deploy"])
    settle_end = int(marks["settle_end"])
    read_end = int(marks["read_end"])
    idle = [b for b in blocks if settle_end <= b["epoch"] < deploy]
    post = [b for b in blocks if b["epoch"] >= deploy]
    carriers = [b for b in post if b["deploy_count"] >= 1]
    target = carriers[0]["number"] if len(carriers) == 1 else None

    errors = run / "blocks-read-errors.txt"
    read_errors = 0
    if errors.exists():
        read_errors = sum(
            1 for line in errors.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.startswith("#")
        )

    return {
        "run": run.name,
        "void": False,
        "sampledNodes": len(sampled),
        "senders": len({b["sender"] for b in post}),
        "idleBlocks": len(idle),
        "deployBearingBlocks": len(carriers),
        "postDeployBlocks": len(post),
        "readWindowSeconds": read_end - deploy,
        "blockReadErrors": read_errors,
        "timeToFinalitySeconds": (
            ttf(series, deploy, target) if target is not None else None
        ),
    }

def arm(root):
    sweep = resolve(root)
    return {
        "sweep": str(sweep),
        "attempts": [
            attempt(sweep / f"n3-noauto-a{i}")
            for i in range(1, ATTEMPTS + 1)
        ],
    }

def integrity_errors(row):
    if row.get("void"):
        return ["void: " + row.get("voidReason", "unknown")]
    errors = []
    if row["sampledNodes"] != NODES:
        errors.append(f"sampledNodes={row['sampledNodes']} expected={NODES}")
    if row["senders"] != NODES:
        errors.append(f"senders={row['senders']} expected={NODES}")
    if row["idleBlocks"] != 0:
        errors.append(f"idleBlocks={row['idleBlocks']} expected=0")
    if row["deployBearingBlocks"] != 1:
        errors.append(
            f"deployBearingBlocks={row['deployBearingBlocks']} expected=1"
        )
    if row["blockReadErrors"] != 0:
        errors.append(f"blockReadErrors={row['blockReadErrors']} expected=0")
    if row["readWindowSeconds"] != 180:
        errors.append(
            f"readWindowSeconds={row['readWindowSeconds']} expected=180"
        )
    return errors

def main():
    if len(sys.argv) not in (3, 4):
        raise SystemExit(
            "usage: evaluate_rchain_c171_pace_effect.py "
            "<candidate-root> <cadence-off-root> [output-json]"
        )

    candidate = arm(sys.argv[1])
    negative = arm(sys.argv[2])

    blocked = []
    failed = []

    for label, data in (("candidate", candidate), ("cadence-off", negative)):
        for i, row in enumerate(data["attempts"], 1):
            errors = integrity_errors(row)
            if errors:
                blocked.append(
                    f"{label} attempt {i}: " + "; ".join(errors)
                )

    candidate_final = [
        row["timeToFinalitySeconds"] for row in candidate["attempts"]
        if not row.get("void")
    ]
    negative_final = [
        row["timeToFinalitySeconds"] for row in negative["attempts"]
        if not row.get("void")
    ]

    if not blocked:
        for i, value in enumerate(candidate_final, 1):
            if value is None:
                failed.append(f"candidate attempt {i}: no finality")

        candidate_blocks = [
            row["postDeployBlocks"] for row in candidate["attempts"]
        ]
        negative_blocks = [
            row["postDeployBlocks"] for row in negative["attempts"]
        ]

        negative_red_by_liveness = any(v is None for v in negative_final)
        negative_red_by_rate = (
            not negative_red_by_liveness
            and max(candidate_blocks) < min(negative_blocks)
        )

        if not negative_red_by_liveness and not negative_red_by_rate:
            failed.append(
                "cadence-off control was not red: block-count ranges overlap "
                "and all negative-control attempts finalized"
            )
    else:
        candidate_blocks = [
            row.get("postDeployBlocks") for row in candidate["attempts"]
        ]
        negative_blocks = [
            row.get("postDeployBlocks") for row in negative["attempts"]
        ]
        negative_red_by_liveness = False
        negative_red_by_rate = False

    status = "BLOCKED" if blocked else ("FAIL" if failed else "PASS")
    report = {
        "schema": "rchain-c171-pace-effect/v1",
        "status": status,
        "upstreamRevision": "51935310789a1a75a183ad0af7152e4eef450c88",
        "quantity": "distinct post-deploy block hashes per 180-second reading window",
        "candidate": candidate,
        "cadenceOff": negative,
        "candidateBlocks": candidate_blocks,
        "cadenceOffBlocks": negative_blocks,
        "candidateFinalitySeconds": candidate_final,
        "cadenceOffFinalitySeconds": negative_final,
        "negativeRedByRateSeparation": negative_red_by_rate,
        "negativeRedByLivenessLoss": negative_red_by_liveness,
        "acceptance": (
            "candidate finalizes in all attempts and cadence-off is red by "
            "complete block-count range separation or loss of finality"
        ),
        "blockedReasons": blocked,
        "failureReasons": failed,
        "claimBoundary": [
            "PASS demonstrates a causal network-level effect of the own-quiet cadence under the pinned N=3 rig.",
            "PASS does not close C171 or establish validator-count independence.",
            "If PASS is only by negative-control liveness loss, no rate bound is inferred.",
            "No upstream change is made by this gate.",
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
