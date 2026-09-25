#!/usr/bin/env python3
"""Run Casper's real play/replay interpreter pipeline on the pinned Rust commit."""
import argparse
import json
from pathlib import Path
import subprocess

from cbc_slashing_lifecycle import PIN, digest

TARGET = 'aria_casper_runtime_slashing'
EXPECTED = [
    f'ARIA_CASPER_REAL_V1|height={height}|pending={pending}|bonded={bonded}|claim={claim}|play_replay_equal=true'
    for height, pending, bonded, claim in [
        (5, 'true', 'true', 0), (6, 'true', 'false', 0),
        (7, 'true', 'true', 0), (10, 'false', 'false', 30),
    ]
]


def run(checkout, out):
    checkout, out = Path(checkout).resolve(), Path(out).resolve()
    rev = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=checkout, text=True).strip()
    status = subprocess.check_output(['git', 'status', '--porcelain'], cwd=checkout, text=True).strip()
    if rev != PIN or status:
        raise ValueError('Require untouched pinned Rust checkout')
    source = Path(__file__).resolve().parents[1] / 'tests/slashing/casper_runtime_slashing.rs'
    common = checkout / 'casper/tests/common/mod.rs'
    fixture = checkout / f'casper/tests/{TARGET}.rs'
    if fixture.exists():
        raise ValueError('Existing test path; refusing overwrite')
    out.mkdir(parents=True, exist_ok=True)
    command = ['cargo', 'test', '--locked', '-p', 'rchain-casper', '--test', TARGET,
               '--', '--nocapture', '--test-threads=1']
    report = {'source_sha': PIN, 'fixture_sha256': digest(source.read_bytes()),
              'common_sha256': digest(common.read_bytes()), 'command': command,
              'level': 'CASPER_RUNTIME_PLAY_REPLAY', 'signed_ingress': False,
              'peer_consensus': False, 'complete': False}
    (out / 'casper_runtime_slashing.rs').write_bytes(source.read_bytes())
    try:
        fixture.write_bytes(source.read_bytes())
        result = subprocess.run(command, cwd=checkout, capture_output=True, timeout=1800)
        stdout, stderr = result.stdout.decode(errors='replace'), result.stderr.decode(errors='replace')
        (out / 'casper-runtime.stdout').write_text(stdout)
        (out / 'casper-runtime.stderr').write_text(stderr)
        report['exit_code'] = result.returncode
        report['stdout_sha256'] = digest(result.stdout)
        report['stderr_sha256'] = digest(result.stderr)
        observed = ['ARIA_CASPER_REAL_V1|' + line.split('ARIA_CASPER_REAL_V1|', 1)[1].strip()
                    for line in stdout.splitlines() if 'ARIA_CASPER_REAL_V1|' in line]
        report['observed'] = observed
        if (result.returncode != 0 or 'test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out;' not in stdout
                or sorted(observed) != sorted(EXPECTED)):
            raise ValueError('Real Casper runtime observations missing or unexpected; inspect raw logs')
        report['complete'] = True
    finally:
        fixture.unlink(missing_ok=True)
        (out / 'casper-runtime.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkout', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    print(json.dumps(run(args.checkout, args.out), indent=2))
