"""Serialization/receipt regressions; these tests do not execute Lean or Rust."""
import sys
from copy import deepcopy
from pathlib import Path
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools'))
from cbc_check_lean_stake import encode, check_axioms, nat, generate, mutation_controls
from cbc_cross_fork_probe import TARGETS


class LeanBridgeTests(unittest.TestCase):
    def test_generator_and_mutations_preserve_original_evidence(self):
        packet = {'sourceGraph': {'bondsMap': {'v0': 70, 'v1': 30}}}
        report = {'modelVsRustByTarget': [
            {'target': n, 'sourceSha': pin, 'observedRust': {
                'support_map': {'v0': {'v1': ['v0', 'v1']}},
                'supporting_stake': 70, 'total_stake': 100,
                'initial_fringe_predicate': True}}
            for n, (_, pin) in TARGETS.items()]}
        original = deepcopy((report, packet))
        code, cases, names = generate(report, packet)
        self.assertEqual(len(names), 12)
        self.assertEqual(code.count(':= by decide'), 12)
        for _, changed_report, changed_packet in mutation_controls(report, packet):
            changed_code, _, _ = generate(changed_report, changed_packet)
            self.assertNotEqual(code, changed_code)
        self.assertEqual((report, packet), original)
        report['modelVsRustByTarget'][-1] = report['modelVsRustByTarget'][0]
        with self.assertRaises(ValueError):
            generate(report, packet)

    def test_order_preserving_bijection_includes_unbonded_sender(self):
        b, s, mapping = encode({'v2': 30, 'v0': 70}, {'v9': {'v2': ['v0', 'v2']}})
        self.assertEqual(mapping, {'v0': 0, 'v2': 1, 'v9': 2})
        self.assertEqual(b, '[(0, 70), (1, 30)]')
        self.assertEqual(s, '[(2, [(1, [0, 1])])]')

    def test_reject_duplicate_or_unsorted_set(self):
        for seen in (['v0', 'v0'], ['v2', 'v0']):
            with self.assertRaises(ValueError):
                encode({'v0': 1}, {'v0': {'v0': seen}})

    def test_reject_invalid_natural(self):
        for value in (-1, True, 1.5, '10'):
            with self.assertRaises(ValueError):
                nat(value)

    def test_reject_missing_or_admitted_theorem(self):
        for log in ('', "'AriaReplay.a' depends on axioms: [sorryAx]", "'AriaReplay.a' depends on axioms: [Lean.ofReduceBool]"):
            with self.assertRaises(ValueError):
                check_axioms(log, ['AriaReplay.a'])

    def test_accept_only_one_empty_axiom_audit(self):
        log = "'AriaReplay.a' does not depend on any axioms"
        check_axioms(log, ['AriaReplay.a'])
        with self.assertRaises(ValueError):
            check_axioms(log + '\n' + log, ['AriaReplay.a'])


if __name__ == '__main__':
    unittest.main()
