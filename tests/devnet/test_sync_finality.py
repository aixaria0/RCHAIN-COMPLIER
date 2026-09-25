import copy
import unittest

from sync_finality import PUBKEYS, STAKES, Runner, common_finality, genesis_info


class FinalityEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.block = {"blockInfo": {"blockNumber": 4, "blockHash": "a" * 64,
                                    "postStateHash": "b" * 64, "shardId": "/root"}}

    def test_matching_advanced_finality(self):
        self.assertEqual(common_finality(self.block, self.block, 0, [True, True])["blockNumber"], 4)

    def test_genesis_or_tip_progress_is_insufficient(self):
        with self.assertRaises(ValueError):
            common_finality(self.block, self.block, 4, [True, True])
        with self.assertRaises(ValueError):
            common_finality({"latestBlockNumber": 30}, self.block, 0, [True, True])

    def test_equal_heights_do_not_mask_hash_or_state_mismatch(self):
        for field in ("blockHash", "postStateHash"):
            altered = copy.deepcopy(self.block)
            altered["blockInfo"][field] = "c" * 64
            with self.subTest(field=field), self.assertRaises(ValueError):
                common_finality(self.block, altered, 0, [True, True])

    def test_both_finalization_confirmations_are_required(self):
        for confirmations in ([True, False], [True], [True, "true"], [1, 1]):
            with self.subTest(confirmations=confirmations), self.assertRaises(ValueError):
                common_finality(self.block, self.block, 0, confirmations)

    def test_malformed_block_fails_closed(self):
        for field, value in (("blockNumber", True), ("blockNumber", "4"),
                             ("blockHash", ""), ("shardId", "/other")):
            altered = copy.deepcopy(self.block)
            altered["blockInfo"][field] = value
            with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                common_finality(altered, self.block, 0, [True, True])

    def test_indexed_genesis_does_not_require_finality_before_proposals(self):
        info = dict(self.block["blockInfo"], blockNumber=0,
                    bonds=[{"validator": key, "stake": stake}
                           for key, stake in zip(PUBKEYS, STAKES)])

        class FreshNode:
            def http(self, node, path):
                if path == "/api/last-finalized-block":
                    raise ValueError("Finalized fringe is not available.")
                if path == "/api/blocks/0/0":
                    return [info]
                raise AssertionError(path)

        self.assertEqual(Runner.synced_genesis(FreshNode()), [info, info])
        for blocks in ([], [info, info], [dict(info, blockNumber=1)],
                       [dict(info, bonds=[])], {"latestBlockNumber": 1}):
            with self.subTest(blocks=blocks), self.assertRaises(ValueError):
                genesis_info(blocks)


if __name__ == "__main__":
    unittest.main()
