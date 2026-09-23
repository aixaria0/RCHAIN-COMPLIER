#!/usr/bin/env python3
"""Check actual Rust observations against pinned upstream Lean stake definitions.

Finite input conformance, not a proof of the Rust program or Casper safety.
"""
import argparse
from copy import deepcopy
import json
import os
from pathlib import Path
import subprocess

from cbc_compare_exact_rust_dag import combine
from cbc_cross_fork_probe import TARGETS, canonical, sha, sha_file

PIN = TARGETS['community'][1]
BOUNDARY = ('Kernel-checked concrete stake equalities for one source-level DAG at four Rust pins. '
            'The Python serialization bridge is tested, not formally proved. No universal Rust '
            'refinement, causal-DAG derivation proof, ingress, live-network or safety theorem.')


def nat(value):
    if type(value) is not int or value < 0:
        raise ValueError('Expected nonnegative integer')
    return str(value)


def encode(bonds, support):
    """Order-preserving bijection from sorted Rust sender strings to Lean Nat.

    Rust sets must already be canonical: do not repair duplicate or reordered evidence.
    """
    if not isinstance(bonds, dict) or not bonds:
        raise ValueError('Expected nonempty bonds')
    if not isinstance(support, dict):
        raise ValueError('Expected support map')
    labels = set(bonds)
    for sender, seers in support.items():
        labels.add(sender)
        if not isinstance(seers, dict):
            raise ValueError('Expected seer map')
        labels.update(seers)
        for seen in seers.values():
            if not isinstance(seen, list) or any(not isinstance(s, str) for s in seen):
                raise ValueError('Expected sender list')
            if seen != sorted(set(seen)):
                raise ValueError('Noncanonical Rust sender set')
            labels.update(seen)
    if any(not isinstance(s, str) or not s for s in labels):
        raise ValueError('Invalid sender label')
    mapping = {s: i for i, s in enumerate(sorted(labels))}
    pair = lambda a, b: '(' + a + ', ' + b + ')'
    array = lambda xs: '[' + ', '.join(xs) + ']'
    lb = array(pair(str(mapping[s]), nat(n)) for s, n in sorted(bonds.items()))
    ls = array(pair(str(mapping[s]), array(
        pair(str(mapping[t]), array(str(mapping[x]) for x in seen))
        for t, seen in sorted(seers.items()))) for s, seers in sorted(support.items()))
    return lb, ls, mapping


def generate(report, packet):
    rows = report['modelVsRustByTarget']
    if len(rows) != len(TARGETS) or {x['target'] for x in rows} != set(TARGETS):
        raise ValueError('Missing or duplicate implementation')
    code = ['import Rchain.Casper.Stake', '', 'namespace AriaReplay']
    cases, names = [], []
    for row in sorted(rows, key=lambda x: x['target']):
        name = row['target']
        if row['sourceSha'] != TARGETS[name][1]:
            raise ValueError('Wrong Rust pin')
        obs = row['observedRust']
        if type(obs['initial_fringe_predicate']) is not bool:
            raise ValueError('Invalid fringe predicate')
        b, s, mapping = encode(packet['sourceGraph']['bondsMap'], obs['support_map'])
        code += [f'def {name}_bonds : Rchain.Bonds := {b}',
                 f'def {name}_support : Rchain.SupportMap := {s}']
        goals = {
            'stake': f'Rchain.fullPartitionStake {name}_support {name}_bonds = {nat(obs["supporting_stake"])}',
            'total': f'Rchain.totalStake {name}_bonds = {nat(obs["total_stake"])}',
            'gate': f'Rchain.calculateFringe {name}_support {name}_bonds = {str(obs["initial_fringe_predicate"]).lower()}',
        }
        for suffix, goal in goals.items():
            theorem = f'{name}_{suffix}'
            code += [f'theorem {theorem} : {goal} := by decide',
                     f'#print axioms {theorem}']
            names.append('AriaReplay.' + theorem)
        cases.append({'target': name, 'rustSourceSha': row['sourceSha'],
                      'senderToLeanNat': mapping, 'supportingStake': obs['supporting_stake'],
                      'totalStake': obs['total_stake'], 'initialFringePredicate': obs['initial_fringe_predicate']})
    code += ['end AriaReplay', '']
    return '\n'.join(code), cases, names


def check_axioms(stdout, names):
    lines = stdout.splitlines()
    for name in names:
        expected = f"'{name}' does not depend on any axioms"
        if lines.count(expected) != 1:
            raise ValueError('Missing or nonempty theorem axiom audit: ' + name)
    if 'sorry' in stdout.lower():
        raise ValueError('Lean admission detected')


def mutation_controls(report, packet):
    """Deliberately inconsistent proof inputs, never research observations."""
    wrong_stake = deepcopy(report)
    wrong_stake['modelVsRustByTarget'][0]['observedRust']['supporting_stake'] += 1
    wrong_bonds = deepcopy(packet)
    first_bond = sorted(wrong_bonds['sourceGraph']['bondsMap'])[0]
    wrong_bonds['sourceGraph']['bondsMap'][first_bond] += 1
    return [('altered_supporting_stake', wrong_stake, packet),
            ('altered_bonds', report, wrong_bonds)]


def run(bundle, checkout, out):
    bundle, checkout, out = map(lambda p: Path(p).resolve(), (bundle, checkout, out))
    out.mkdir(parents=True, exist_ok=True)
    # Revalidate raw Rust records, source bytes, packet, census, pins, and exit codes.
    report = combine(bundle / 'evidence', bundle / 'fixture/packet.json',
                     bundle / 'evidence/exact-distinct-source-fixture/census.json',
                     bundle / 'fixture/aria_exact_distinct_id_dag.rs')
    if report != json.loads((bundle / 'exact-dag-four-real-finalizers.json').read_text()):
        raise ValueError('Comparison report differs from raw evidence')
    def command(args, cwd=checkout):
        return subprocess.run(args, cwd=cwd, capture_output=True, text=True, check=True).stdout.strip()
    if command(['git', 'rev-parse', 'HEAD']) != PIN:
        raise ValueError('Wrong Lean source revision')
    if command(['git', 'diff', '--name-only', 'HEAD', '--', 'spec']):
        raise ValueError('Modified Lean specification or dependency lock')
    spec = checkout / 'spec'
    source_paths = ['Rchain/Casper/Stake.lean', 'lean-toolchain', 'lakefile.toml', 'lake-manifest.json']
    hashes = {p: sha_file(spec / p) for p in source_paths}
    for p in source_paths:
        dest = out / 'pinned-spec' / p
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes((spec / p).read_bytes())
    packet = json.loads((bundle / 'fixture/packet.json').read_text())
    code, cases, names = generate(report, packet)
    proof = out / 'ExactReplayStake.lean'
    proof.write_text(code)
    cmd = ['lake', 'env', 'lean', str(proof)]
    result = subprocess.run(cmd, cwd=spec, capture_output=True, text=True, timeout=300)
    (out / 'stdout.log').write_text(result.stdout)
    (out / 'stderr.log').write_text(result.stderr)
    record = {'schema': 'aria-cbc-lean-stake-conformance/v1', 'leanSourceRepository': TARGETS['community'][0],
              'leanSourceSha': PIN, 'specSourceSha256': hashes,
              'rustComparisonSha256': report['reportSha256'], 'packetSha256': packet['packetSha256'],
              'graphSha256': packet['exactGraphSha256'], 'generatedLeanSha256': sha_file(proof),
              'command': cmd, 'exitCode': result.returncode,
              'stdoutSha256': sha_file(out / 'stdout.log'), 'stderrSha256': sha_file(out / 'stderr.log'),
              'leanVersion': command(['lake', 'env', 'lean', '--version'], spec),
              'workflowRunId': os.environ.get('GITHUB_RUN_ID'), 'cases': cases,
              'kernelChecked': False, 'universalRustRefinementProved': False,
              'wireIngressVerified': False, 'liveNetworkVerified': False, 'claimBoundary': BOUNDARY}
    # A failed theorem remains a failure artifact, never a successful receipt.
    (out / 'record.json').write_text(json.dumps(record, indent=2) + '\n')
    if result.returncode:
        raise ValueError('Lean rejected concrete Rust observation; inspect raw logs')
    check_axioms(result.stdout, names)
    if hashes != {p: sha_file(spec / p) for p in source_paths}:
        raise ValueError('Specification changed during proof check')
    controls = []
    for label, changed_report, changed_packet in mutation_controls(report, packet):
        changed_code, _, _ = generate(changed_report, changed_packet)
        negative = out / (label + '.lean')
        negative.write_text(changed_code)
        rejected = subprocess.run(['lake', 'env', 'lean', str(negative)], cwd=spec,
                                  capture_output=True, text=True, timeout=300)
        log = out / (label + '.log')
        log.write_text(rejected.stdout + rejected.stderr)
        if rejected.returncode == 0 or "tactic 'decide'" not in rejected.stdout:
            raise ValueError('Mutation control did not fail at proof checking: ' + label)
        controls.append({'name': label, 'expectedRejection': True,
                         'exitCode': rejected.returncode, 'logSha256': sha_file(log),
                         'generatedLeanSha256': sha_file(negative)})
    record['negativeControls'] = controls
    record['kernelChecked'] = True
    record['theorems'] = names
    record['recordSha256'] = sha(canonical(record))
    (out / 'record.json').write_text(json.dumps(record, indent=2) + '\n')
    print(json.dumps({'result': 'LEAN_KERNEL_CHECKED_FINITE_STAKE_CONFORMANCE', 'theorems': len(names),
                      'claimBoundary': BOUNDARY}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', required=True)
    parser.add_argument('--checkout', required=True)
    parser.add_argument('--out-dir', required=True)
    args = parser.parse_args()
    run(args.bundle, args.checkout, args.out_dir)
