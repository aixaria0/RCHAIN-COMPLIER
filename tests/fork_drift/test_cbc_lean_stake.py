"""Serialization/receipt regressions; these tests do not execute Lean or Rust."""
import sys
from pathlib import Path
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools'))
from cbc_check_lean_stake import encode, check_axioms, nat


class LeanBridgeTests(unittest.TestCase):
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
