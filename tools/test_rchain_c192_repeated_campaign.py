#!/usr/bin/env python3
import tempfile
from pathlib import Path

from evaluate_rchain_c192_repeated_campaign import summarize_arm

def write_attempt(root: Path, attempt: int, finalized: bool):
    run = root / "fixture" / f"n3-noauto-a{attempt}"
    run.mkdir(parents=True)
    base = 1000 + attempt * 1000
    deploy = base + 120
    read_end = deploy + 180
    (run / "marks.tsv").write_text(
        f"arm\tnoauto\n"
        f"n\t3\n"
        f"attempt\t{attempt}\n"
        f"t0\t{base}\n"
        f"settle_end\t{base + 60}\n"
        f"idle_end_and_deploy\t{deploy}\n"
        f"read_end\t{read_end}\n",
        encoding="utf-8",
    )
    (run / "blocks.tsv").write_text(
        "# first_seen_epoch\tblock_number\tsender\tdeploy_count\tparents\tblock_hash\n"
        f"{deploy}\t1\ta\t1\t1\th{attempt}a\n"
        f"{deploy + 1}\t1\tb\t0\t1\th{attempt}b\n"
        f"{deploy + 2}\t1\tc\t0\t1\th{attempt}c\n",
        encoding="utf-8",
    )
    rows = [
        "utc\tepoch\tnode\theight\tfinalized\talive",
        f"00:00:00\t{deploy}\tbootstrap\t1\tnone\t1",
        f"00:00:00\t{deploy}\tv1\t1\tnone\t1",
        f"00:00:00\t{deploy}\tv2\t1\tnone\t1",
    ]
    if finalized:
        rows += [
            f"00:00:03\t{deploy + 3}\tbootstrap\t2\t1\t1",
            f"00:00:03\t{deploy + 3}\tv1\t2\t1\t1",
            f"00:00:03\t{deploy + 3}\tv2\t2\t1\t1",
        ]
    (run / "series.tsv").write_text("\n".join(rows) + "\n", encoding="utf-8")

def main():
    with tempfile.TemporaryDirectory() as tmp:
        control_root = Path(tmp) / "control"
        candidate_root = Path(tmp) / "candidate"
        control_root.mkdir()
        candidate_root.mkdir()
        for i in range(1, 4):
            write_attempt(control_root, i, finalized=False)
            write_attempt(candidate_root, i, finalized=True)

        control = summarize_arm(control_root)
        candidate = summarize_arm(candidate_root)

        assert len(control["attempts"]) == 3
        assert len(candidate["attempts"]) == 3
        assert all(a["sampledNodes"] == 3 for a in control["attempts"])
        assert all(a["timeToFinalitySeconds"] is None for a in control["attempts"])
        assert all(a["timeToFinalitySeconds"] == 3 for a in candidate["attempts"])

if __name__ == "__main__":
    main()
