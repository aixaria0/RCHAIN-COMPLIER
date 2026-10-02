#!/usr/bin/env python3
import tempfile
from pathlib import Path

from evaluate_rchain_c171_pace_effect import arm, integrity_errors

def write_attempt(root: Path, attempt: int, blocks: int, finality):
    run = root / "fixture" / f"n3-noauto-a{attempt}"
    run.mkdir(parents=True)
    base = 1000 + attempt * 1000
    deploy = base + 120
    (run / "marks.tsv").write_text(
        f"arm\tnoauto\n"
        f"n\t3\n"
        f"attempt\t{attempt}\n"
        f"t0\t{base}\n"
        f"settle_end\t{base + 60}\n"
        f"idle_end_and_deploy\t{deploy}\n"
        f"read_end\t{deploy + 180}\n",
        encoding="utf-8",
    )
    rows = [
        "# first_seen_epoch\tblock_number\tsender\tdeploy_count\tparents\tblock_hash"
    ]
    for i in range(blocks):
        sender = ("a", "b", "c")[i % 3]
        rows.append(
            f"{deploy + i}\t{i + 1}\t{sender}\t{1 if i == 0 else 0}\t1\th{attempt}-{i}"
        )
    (run / "blocks.tsv").write_text("\n".join(rows) + "\n", encoding="utf-8")

    series = [
        "utc\tepoch\tnode\theight\tfinalized\talive",
        f"00:00:00\t{deploy}\tbootstrap\t1\tnone\t1",
        f"00:00:00\t{deploy}\tv1\t1\tnone\t1",
        f"00:00:00\t{deploy}\tv2\t1\tnone\t1",
    ]
    if finality is not None:
        e = deploy + finality
        series += [
            f"00:00:03\t{e}\tbootstrap\t2\t1\t1",
            f"00:00:03\t{e}\tv1\t2\t1\t1",
            f"00:00:03\t{e}\tv2\t2\t1\t1",
        ]
    (run / "series.tsv").write_text("\n".join(series) + "\n", encoding="utf-8")

def main():
    with tempfile.TemporaryDirectory() as tmp:
        candidate_root = Path(tmp) / "candidate"
        negative_root = Path(tmp) / "negative"
        candidate_root.mkdir()
        negative_root.mkdir()
        for i, count in enumerate((10, 11, 12), 1):
            write_attempt(candidate_root, i, count, 3)
        for i, count in enumerate((30, 31, 32), 1):
            write_attempt(negative_root, i, count, 3)

        candidate = arm(candidate_root)
        negative = arm(negative_root)

        assert all(not integrity_errors(a) for a in candidate["attempts"])
        assert all(not integrity_errors(a) for a in negative["attempts"])
        assert max(a["postDeployBlocks"] for a in candidate["attempts"]) < min(
            a["postDeployBlocks"] for a in negative["attempts"]
        )

if __name__ == "__main__":
    main()
