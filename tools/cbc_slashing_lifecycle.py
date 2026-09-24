#!/usr/bin/env python3
"""Execute a bounded native PoS regression on original and research-only patched source."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

PIN = '0ac5498fe246ea8a901c9e5277383f672ed9635d'
SOURCE = 'rholang/src/native_state.rs'
TEST_TARGET = 'aria_native_slashing_lifecycle'
SCHEMA = 'aria-cbc-slashing-lifecycle/v1'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def research_patch(source):
    start = source.index('    pub async fn slash(')
    end = source.index('    /// Admit `target`', start)
    body = source[start:end]
    anchor = '        self.set_withdrawers(&withdrawers);\n'
    if body.count(anchor) != 1 or 'self.set_pending_withdrawers(&pending);' in body:
        raise ValueError('Unexpected slash source; refuse ambiguous/already-patched input')
    body = body.replace(anchor, anchor + '        self.set_pending_withdrawers(&pending);\n')
    return source[:start] + body + source[end:]


def verify_run(stdout, returncode, patched):
    passed, failed = (5, 0) if patched else (3, 2)
    status = 'ok' if patched else 'FAILED'
    expected = f'test result: {status}. {passed} passed; {failed} failed; 0 ignored; 0 measured; 0 filtered out;'
    if returncode != (0 if patched else 101) or expected not in stdout:
        raise ValueError('Unexpected test outcome; compilation/infrastructure failures are not evidence')
    markers = ['ARIA_SLASH_V1|' + line.split('ARIA_SLASH_V1|', 1)[1].strip()
               for line in stdout.splitlines() if 'ARIA_SLASH_V1|' in line]
    expected_markers = [
        f'ARIA_SLASH_V1|case=pending_grid|cases=9|stale={0 if patched else 9}',
        f'ARIA_SLASH_V1|case=rebond|bonded_at_boundary={str(patched).lower()}|claim={0 if patched else 30}|wallet_at_30={70 if patched else 100}',
    ]
    if sorted(markers) != sorted(expected_markers):
        raise ValueError('Missing, duplicated, or unexpected native state observations')
    if not patched:
        failures = stdout.split('failures:\n')[-1].split('test result:')[0]
        names = re.findall(r'^    (contract_\w+)$', failures, re.M)
        if sorted(names) != sorted(['contract_slash_cancels_pending_withdrawal_grid',
                                   'contract_new_bond_does_not_inherit_cancelled_withdrawal']):
            raise ValueError('Unexpected failing contracts')
    return {'passed': passed, 'failed': failed, 'exit_code': returncode,
            'raw_observations': markers, 'research_patch_applied': patched}


def run(checkout, out):
    checkout, out = Path(checkout).resolve(), Path(out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    def git(*args):
        return subprocess.check_output(['git', *args], cwd=checkout, text=True).strip()
    if git('rev-parse', 'HEAD') != PIN or git('status', '--porcelain'):
        raise ValueError('Require clean checkout at exact source pin')
    root = Path(__file__).resolve().parents[1]
    test_source = (root / 'tests/slashing/native_slashing_lifecycle.rs').read_bytes()
    source_path, lock_path = checkout / SOURCE, checkout / 'Cargo.lock'
    original, lock = source_path.read_bytes(), lock_path.read_bytes()
    patched_bytes = research_patch(original.decode()).encode()
    test_path = checkout / 'rholang/tests' / (TEST_TARGET + '.rs')
    if test_path.exists():
        raise ValueError('Refuse to overwrite an existing test')
    for name, data in [('original-native_state.rs', original), ('research-native_state.rs', patched_bytes),
                       ('source-Cargo.lock', lock), ('native_slashing_lifecycle.rs', test_source)]:
        (out / name).write_bytes(data)
    cmd = ['cargo', 'test', '--locked', '-p', 'rchain-rholang', '--test', TEST_TARGET,
           '--', '--nocapture', '--test-threads=1']
    report = {'schema': SCHEMA, 'repository': 'rchain-community/rchain-rust', 'source_sha': PIN,
              'evidence_level': 'SOURCE_LEVEL_RUST_NATIVE_POS', 'ingress_verified': False,
              'live_network_verified': False, 'production_patch_applied': False,
              'source_sha256': digest(original), 'patched_source_sha256': digest(patched_bytes),
              'test_sha256': digest(test_source), 'lock_sha256': digest(lock), 'command': cmd,
              'runner_commit': os.getenv('GITHUB_SHA'), 'workflow_run_id': os.getenv('GITHUB_RUN_ID'),
              'runs': {}, 'complete': False}
    try:
        test_path.write_bytes(test_source)
        for variant, code in [('original', original), ('research_patch', patched_bytes)]:
            source_path.write_bytes(code)
            proc = subprocess.run(cmd, cwd=checkout, capture_output=True, timeout=1800)
            stdout, stderr = proc.stdout.decode(errors='replace'), proc.stderr.decode(errors='replace')
            (out / f'{variant}.stdout').write_text(stdout)
            (out / f'{variant}.stderr').write_text(stderr)
            observed = verify_run(stdout, proc.returncode, variant == 'research_patch')
            if source_path.read_bytes() != code or lock_path.read_bytes() != lock:
                raise ValueError('Source or dependency lock changed during execution')
            report['runs'][variant] = {**observed, 'stdout_sha256': digest(proc.stdout),
                                      'stderr_sha256': digest(proc.stderr)}
        report['complete'] = True
    finally:
        source_path.write_bytes(original)
        test_path.unlink(missing_ok=True)
        (out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkout', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    print(json.dumps(run(args.checkout, args.out), indent=2))
