#!/usr/bin/env python3
import tempfile
from pathlib import Path

from evaluate_rchain_attestation_devnet_smoke import summarize


def write_fixture(root: Path, *, finalized: bool) -> None:
    run = root / "fixture" / "n3-noauto-a1"
    run.mkdir(parents=True)

    (run / "marks.tsv").write_text(
        "arm\tnoauto\n"
        "n\t3\n"
        "attempt\t1\n"
        "t0\t100\n"
        "settle_end\t105\n"
        "idle_end_and_deploy\t110\n"
        "read_end\t200\n",
        encoding="utf-8",
    )
    (run / "blocks.tsv").write_text(
        "# first_seen_epoch\tblock_number\tsender\tdeploy_count\tparents\tblock_hash\n"
        "110\t1\ta\t1\t1\th1\n"
        "111\t1\tb\t0\t1\th2\n"
        "112\t1\tc\t0\t1\th3\n",
        encoding="utf-8",
    )

    rows = [
        "utc\tepoch\tnode\theight\tfinalized\talive",
        "00:00:10\t110\tbootstrap\t1\tnone\t1",
        "00:00:10\t110\tv1\t1\tnone\t1",
        "00:00:10\t110\tv2\t1\tnone\t1",
    ]
    if finalized:
        rows += [
            "00:00:13\t113\tbootstrap\t2\t1\t1",
            "00:00:13\t113\tv1\t2\t1\t1",
            "00:00:13\t113\tv2\t2\t1\t1",
        ]
    (run / "series.tsv").write_text("\n".join(rows) + "\n", encoding="utf-8")


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        control_root = Path(tmp) / "control"
        candidate_root = Path(tmp) / "candidate"
        control_root.mkdir()
        candidate_root.mkdir()
        write_fixture(control_root, finalized=False)
        write_fixture(candidate_root, finalized=True)

        control = summarize(control_root)
        candidate = summarize(candidate_root)

        assert control["sampledNodes"] == 3
        assert control["senders"] == 3
        assert control["timeToFinalitySeconds"] is None

        assert candidate["sampledNodes"] == 3
        assert candidate["senders"] == 3
        assert candidate["timeToFinalitySeconds"] == 3


if __name__ == "__main__":
    main()
