// M18 — exact threshold boundary for duplicate-minimum cardinality.
//
// The upstream rule is intentionally strict: exactly 2/3 stake is not enough.
// M18 separates that correct threshold behavior from the cardinality mismatch:
// N=3 with two supported senders reaches exactly 2/3 and does not finalize,
// while N=4 with three supported senders reaches 3/4 and does finalize.

#[cfg(test)]
mod m18_exact_threshold_boundary {
    use std::collections::{BTreeMap, BTreeSet};

    use super::{Finalizer, Message};
    use rchain_shared::refined::{BlockHeight, NonNegI64, SeqNum};

    fn msg(
        id: &str,
        sender: &str,
        seq: i64,
        parents: &[&str],
        seen: &[&str],
    ) -> Message<String, String> {
        Message {
            id: id.to_string(),
            height: BlockHeight::try_from(seq).unwrap(),
            sender: sender.to_string(),
            sender_seq: SeqNum::try_from(seq).unwrap(),
            bonds_map: BTreeMap::new(),
            parents: parents.iter().map(|x| (*x).to_string()).collect(),
            fringe: BTreeSet::new(),
            seen: seen.iter().map(|x| (*x).to_string()).collect(),
        }
    }

    #[test]
    fn three_equal_validators_do_not_finalize_at_exact_two_thirds() {
        let bonds: BTreeMap<String, NonNegI64> =
            [("v0", 1), ("v1", 1), ("v2", 1)]
                .into_iter()
                .map(|(s, stake)| (s.to_string(), NonNegI64::try_from(stake).unwrap()))
                .collect();

        let mut map = BTreeMap::new();
        for (id, sender) in [("g0", "v0"), ("g1", "v1"), ("g2", "v2")] {
            map.insert(id.to_string(), msg(id, sender, 0, &[], &[id]));
        }

        let l1 = ["a1", "b1", "c1"];
        map.insert("a1".into(), msg("a1", "v0", 1, &["g0"], &["g0", "a1"]));
        map.insert("b1".into(), msg("b1", "v1", 1, &["g1"], &["g1", "b1"]));
        map.insert("c1".into(), msg("c1", "v2", 1, &["g2"], &["g2", "c1"]));

        let l2 = ["a2", "b2", "c2"];
        let seen2 = ["g0", "g1", "g2", "a1", "b1", "c1", "a2", "b2", "c2"];
        map.insert("a2".into(), msg("a2", "v0", 2, &l1, &seen2));
        map.insert("b2".into(), msg("b2", "v1", 2, &l1, &seen2));
        map.insert("c2".into(), msg("c2", "v2", 2, &l1, &seen2));

        let seen3 = ["g0", "g1", "g2", "a1", "b1", "c1", "a2", "b2", "c2", "a3"];
        map.insert("a3".into(), msg("a3", "v0", 3, &l2, &seen3));
        map.insert("b3".into(), msg("b3", "v1", 3, &l2, &seen3));

        let justifications: BTreeSet<_> = ["a2", "a3", "b3"]
            .into_iter()
            .map(|id| map[id].clone())
            .collect();

        let finalizer = Finalizer::new(&map);
        let min_msgs = vec![map["g0"].clone(), map["g0"].clone(), map["g1"].clone()];

        assert_eq!(min_msgs.len(), bonds.len());
        assert!(finalizer.check_min_messages(&min_msgs, &bonds));

        let (_parent, new_fringe) =
            finalizer.calculate_finalization(&justifications, &bonds);

        assert!(new_fringe.is_none(), "exactly 2/3 must not finalize");
        assert_eq!(3 * 2, 2 * 3);
    }

    #[test]
    fn four_equal_validators_finalize_at_three_quarters() {
        let bonds: BTreeMap<String, NonNegI64> =
            [("v0", 1), ("v1", 1), ("v2", 1), ("v3", 1)]
                .into_iter()
                .map(|(s, stake)| (s.to_string(), NonNegI64::try_from(stake).unwrap()))
                .collect();

        let mut map = BTreeMap::new();
        for (id, sender) in [("g0", "v0"), ("g1", "v1"), ("g2", "v2"), ("g3", "v3")] {
            map.insert(id.to_string(), msg(id, sender, 0, &[], &[id]));
        }

        let l1 = ["a1", "b1", "c1", "d1"];
        map.insert("a1".into(), msg("a1", "v0", 1, &["g0"], &["g0", "a1"]));
        map.insert("b1".into(), msg("b1", "v1", 1, &["g1"], &["g1", "b1"]));
        map.insert("c1".into(), msg("c1", "v2", 1, &["g2"], &["g2", "c1"]));
        map.insert("d1".into(), msg("d1", "v3", 1, &["g3"], &["g3", "d1"]));

        let l2 = ["a2", "b2", "c2", "d2"];
        let seen2 = [
            "g0", "g1", "g2", "g3", "a1", "b1", "c1", "d1",
            "a2", "b2", "c2", "d2",
        ];
        for (id, sender) in [("a2", "v0"), ("b2", "v1"), ("c2", "v2"), ("d2", "v3")] {
            map.insert(id.to_string(), msg(id, sender, 2, &l1, &seen2));
        }

        let seen3 = [
            "g0", "g1", "g2", "g3", "a1", "b1", "c1", "d1",
            "a2", "b2", "c2", "d2", "a3",
        ];
        map.insert("a3".into(), msg("a3", "v0", 3, &l2, &seen3));
        map.insert("b3".into(), msg("b3", "v1", 3, &l2, &seen3));
        map.insert("c3".into(), msg("c3", "v2", 3, &l2, &seen3));

        let justifications: BTreeSet<_> = ["a2", "a3", "b3", "c3"]
            .into_iter()
            .map(|id| map[id].clone())
            .collect();

        let finalizer = Finalizer::new(&map);
        let min_msgs = vec![
            map["g0"].clone(),
            map["g0"].clone(),
            map["g1"].clone(),
            map["g2"].clone(),
        ];

        assert_eq!(min_msgs.len(), bonds.len());
        assert!(finalizer.check_min_messages(&min_msgs, &bonds));

        let (_parent, new_fringe) =
            finalizer.calculate_finalization(&justifications, &bonds);

        let fringe = new_fringe.expect("3/4 must finalize");
        let senders: BTreeSet<_> = fringe.iter().map(|m| m.sender.as_str()).collect();

        assert_eq!(senders, ["v0", "v1", "v2"].into_iter().collect());
        assert_eq!(fringe.len(), 3);
        assert!(3 * 3 > 2 * 4);
    }
}
