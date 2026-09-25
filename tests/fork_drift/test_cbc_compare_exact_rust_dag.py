"""Parser/transport negative controls; synthetic unit data is not Rust evidence."""
import json
import pathlib
import sys
import tempfile
import unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / 'tools'))
from cbc_run_exact_rust_dag import parse
from cbc_compare_exact_rust_dag import combine
from test_cbc_emit_exact_rust_dag import packet


def marker():
    return ('ARIA_EXACT_DAG_V1|graph_sha256=' + 'a'*64 + '|packet_sha256=' + 'b'*64
        + '|source_message_count=16|unique_justifications=4|minimum_message_ids=g0,g0,g1,g2'
        + '|minimum_unique_senders=3|count_gate=true|next_layer_senders=3|new_fringe=true'
        + '|new_fringe_ids=a1,b1,c1|next_layer_ids={"v0":"g0","v1":"g1","v2":"g2"}'
        + '|support_map={"v0":{"v0":["v0","v1","v2","v3"]}}'
        + '|supporting_stake=70|total_stake=100|initial_fringe_predicate=true')


class ExactEvidenceTests(unittest.TestCase):
    def test_intermediate_observation_and_repeated_minimum_identity_preserved(self):
        r = parse(marker())
        self.assertEqual(r['minimum_message_ids'], ['g0','g0','g1','g2'])
        self.assertEqual(r['supporting_stake'], 70)
        self.assertEqual(r['next_layer_ids'], {'v0':'g0','v1':'g1','v2':'g2'})

    def test_missing_duplicate_marker_and_inconsistent_stake_rejected(self):
        for value in ('', marker()+'\n'+marker(), marker().replace('total_stake=100','total_stake=60'),
                      marker().replace('next_layer_senders=3','next_layer_senders=4')):
            with self.assertRaises(ValueError):
                parse(value)

    def test_packet_tampering_rejected_before_reading_execution_records(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            p = packet()
            p['sourceGraph']['bondsMap']['v0'] = 99
            (root/'packet.json').write_text(json.dumps(p))
            (root/'census.json').write_text('{}')
            (root/'test.rs').write_text('forged source')
            with self.assertRaisesRegex(ValueError, 'Packet integrity'):
                combine(root, root/'packet.json', root/'census.json', root/'test.rs')

if __name__ == '__main__':
    unittest.main()
