#!/usr/bin/env python3
import sys
import tempfile
import unittest
from pathlib import Path

from inject_rchain_attestation_trace import rewrite, untrace, INSERTIONS, FAILED_ANCHOR, SUCCESS_ANCHOR
from summarize_rchain_attestation_trace import summarize_node, summarize


DECISION = ('C171_TRACE_V1 phase=decision block=hashA height=1 own=1 round=1 tip=1 '
            'strict=true cadence=false remote=false self=true')
QUEUE = 'C171_TRACE_V1 phase=queue block=hashA height=1 outcome=accepted'


class TraceTests(unittest.TestCase):
    def parse(self, lines):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / 'log.txt'
            path.write_text('\n'.join(lines), encoding='utf-8')
            return summarize_node(path)

    def test_self_trigger_bypasses_false_cadence_is_observed(self):
        row = self.parse(['ordinary warning', DECISION, QUEUE])
        self.assertEqual(row['errors'], [])
        self.assertEqual(row['selfDueWithCadenceFalse'], 1)
        self.assertEqual(row['cadenceSuppressedStrictEligible'], 1)
        self.assertEqual(row['queueAccepted'], 1)

    def test_rejected_queue_is_retained(self):
        row = self.parse([DECISION, QUEUE.replace('accepted', 'rejected')])
        self.assertEqual(row['queueRejected'], 1)
        self.assertEqual(row['errors'], [])

    def test_missing_queue_outcome_blocks(self):
        self.assertTrue(self.parse([DECISION])['errors'])

    def test_unmatched_queue_blocks(self):
        self.assertTrue(self.parse([DECISION, QUEUE.replace('hashA', 'hashB')])['errors'])

    def test_inconsistent_remote_predicate_is_rejected(self):
        with self.assertRaises(ValueError):
            self.parse([DECISION.replace('remote=false', 'remote=true'), QUEUE])

    def test_malformed_and_no_trace_are_not_complete(self):
        with self.assertRaises(ValueError):
            self.parse(['C171_TRACE_V1 phase=unknown'])
        self.assertTrue(self.parse(['ordinary log'])['errors'])

    def test_multiple_records_do_not_collapse(self):
        row = self.parse([DECISION, QUEUE, DECISION, QUEUE])
        self.assertEqual(row['decisionCount'], 2)
        self.assertEqual(row['queueAccepted'], 2)
        self.assertEqual(row['errors'], [])

    def test_missing_arm_is_blocked(self):
        with tempfile.TemporaryDirectory() as root:
            self.assertTrue(summarize(root)['errors'])

    def test_reversible_fail_closed_injection(self):
        source = 'fn stalled_round_self_trigger_warranted(\n' + ''.join(a for a, _ in INSERTIONS)
        source += FAILED_ANCHOR + SUCCESS_ANCHOR
        traced = rewrite(source)
        self.assertEqual(untrace(traced), source)
        with self.assertRaises(ValueError):
            rewrite(traced)
        with self.assertRaises(ValueError):
            rewrite(source + INSERTIONS[0][0])
        with self.assertRaises(ValueError):
            rewrite(source.replace(FAILED_ANCHOR, ''))


if __name__ == '__main__':
    if len(sys.argv) == 2:
        path = Path(sys.argv.pop())
        candidate = path.read_text(encoding='utf-8')
        assert untrace(rewrite(candidate)) == candidate, 'real candidate roundtrip failed'
        print('Real candidate byte-for-byte roundtrip passed')
    unittest.main()
