import sys
from pathlib import Path
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools'))
from cbc_slashing_lifecycle import research_patch, verify_run


def log(patched=False):
    return (
        f'test contract_pending ... ARIA_SLASH_V1|case=pending_grid|cases=9|stale={0 if patched else 9}\n'
        f'test contract_rebond ... ARIA_SLASH_V1|case=rebond|bonded_at_boundary={str(patched).lower()}|claim={0 if patched else 30}|wallet_at_30={70 if patched else 100}\n'
        + ('' if patched else 'failures:\n    contract_slash_cancels_pending_withdrawal_grid\n    contract_new_bond_does_not_inherit_cancelled_withdrawal\n\n')
        + f'test result: {"ok" if patched else "FAILED"}. {5 if patched else 3} passed; {0 if patched else 2} failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.1s\n')


class EvidenceTest(unittest.TestCase):
    def test_expected_results_are_accepted(self):
        for patched in (False, True):
            self.assertEqual(verify_run(log(patched), 0 if patched else 101, patched)['failed'], 0 if patched else 2)

    def test_compile_failure_is_not_expected_regression(self):
        with self.assertRaises(ValueError):
            verify_run('error[E0308]: mismatched types', 101, False)

    def test_zero_tests_or_ignored_tests_cannot_pass(self):
        for changed in ('0 passed; 2 failed', '3 passed; 2 failed; 1 ignored'):
            with self.assertRaises(ValueError):
                verify_run(log().replace('3 passed; 2 failed' + ('; 0 ignored' if 'ignored' in changed else ''), changed), 101, False)

    def test_wrong_failure_is_rejected(self):
        with self.assertRaises(ValueError):
            verify_run(log().replace('    contract_new_bond_does_not_inherit_cancelled_withdrawal', '    contract_other'), 101, False)

    def test_changed_or_duplicate_observations_are_rejected(self):
        for text in [log().replace('stale=9', 'stale=8'), log() + 'ARIA_SLASH_V1|case=pending_grid|cases=9|stale=9\n']:
            with self.assertRaises(ValueError):
                verify_run(text, 101, False)

    def test_patch_is_scoped_to_slash_and_not_idempotently_reapplied(self):
        fragment = '        self.set_withdrawers(&withdrawers);\n'
        before = fragment + '    pub async fn slash(\n' + fragment + '    /// Admit `target`\n' + fragment
        after = research_patch(before)
        self.assertEqual(after.count('self.set_pending_withdrawers(&pending);'), 1)
        self.assertTrue(after.startswith(fragment))
        self.assertTrue(after.endswith(fragment))
        with self.assertRaises(ValueError):
            research_patch(after)
