// M16 — counterfactual minimum-sender coverage invariant.
//
// This is intentionally NOT an upstream patch. It tests the smallest proposed
// semantic strengthening of the count-only gate: require the sender set of the
// minimum messages to equal the bonded-sender set.

#[cfg(test)]
mod m16_counterfactual_coverage_invariant {
    use std::collections::{BTreeMap, BTreeSet};

    use rchain_block_storage::dag::finalizer::{Finalizer, Message};
    use rchain_shared::refined::{BlockHeight, NonNegI64, SeqNum};

    fn msg(id: &str, sender: &str) -> Message<String, String> {
        Message {
            id: id.to_string(),
            height: BlockHeight::zero(),
            sender: sender.to_string(),
            sender_seq: SeqNum::zero(),
            bonds_map: BTreeMap::new(),
            parents: BTreeSet::new(),
            fringe: BTreeSet::new(),
            seen: BTreeSet::new(),
        }
    }

    fn bonded() -> BTreeMap<String, NonNegI64> {
        [("v0", 70), ("v1", 10), ("v2", 10), ("v3", 10)]
            .into_iter()
            .map(|(s, stake)| (s.to_string(), NonNegI64::try_from(stake).unwrap()))
            .collect()
    }

    fn distinct_sender_coverage(
        min_msgs: &[Message<String, String>],
        bonds: &BTreeMap<String, NonNegI64>,
    ) -> bool {
        let senders: BTreeSet<String> =
            min_msgs.iter().map(|m| m.sender.clone()).collect();
        senders == bonds.keys().cloned().collect()
    }

    #[test]
    fn counterfactual_gate_rejects_duplicate_sender_shape() {
        let map = BTreeMap::new();
        let finalizer = Finalizer::new(&map);
        let bonds = bonded();
        let min_msgs = vec![
            msg("g0a", "v0"),
            msg("g0b", "v0"),
            msg("g1", "v1"),
            msg("g2", "v2"),
        ];

        assert!(finalizer.check_min_messages(&min_msgs, &bonds));
        assert!(!distinct_sender_coverage(&min_msgs, &bonds));
    }

    #[test]
    fn counterfactual_gate_rejects_nonbonded_replacement() {
        let map = BTreeMap::new();
        let finalizer = Finalizer::new(&map);
        let bonds = bonded();
        let min_msgs = vec![
            msg("g0", "v0"),
            msg("g1", "v1"),
            msg("g2", "v2"),
            msg("gx", "vx"),
        ];

        assert!(finalizer.check_min_messages(&min_msgs, &bonds));
        assert!(!distinct_sender_coverage(&min_msgs, &bonds));
    }

    #[test]
    fn counterfactual_gate_preserves_valid_one_per_bonded_sender_shape() {
        let map = BTreeMap::new();
        let finalizer = Finalizer::new(&map);
        let bonds = bonded();
        let min_msgs = vec![
            msg("g0", "v0"),
            msg("g1", "v1"),
            msg("g2", "v2"),
            msg("g3", "v3"),
        ];

        assert!(finalizer.check_min_messages(&min_msgs, &bonds));
        assert!(distinct_sender_coverage(&min_msgs, &bonds));
    }
}
