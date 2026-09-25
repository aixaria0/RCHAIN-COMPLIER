// M14 — Finalizer fringe-cardinality invariant witness.
//
// This test uses the pinned upstream Finalizer itself and asks a narrow question:
// can the public calculate_finalization path return a new fringe whose sender set
// is smaller than the bonded validator set, even though the minimum-message count
// gate passes?

#[cfg(test)]
mod m14_fringe_cardinality_invariant {
    use std::collections::{BTreeMap, BTreeSet};

    use super::{Finalizer, Message};
    use rchain_shared::refined::{BlockHeight, NonNegI64, SeqNum};

    fn msg(
        id: &str,
        sender: &str,
        sender_seq: i64,
        parents: &[&str],
        seen: &[&str],
    ) -> Message<String, String> {
        Message {
            id: id.to_string(),
            height: BlockHeight::zero(),
            sender: sender.to_string(),
            sender_seq: SeqNum::try_from(sender_seq).unwrap(),
            bonds_map: BTreeMap::new(),
            parents: parents.iter().map(|x| (*x).to_string()).collect(),
            fringe: BTreeSet::new(),
            seen: seen.iter().map(|x| (*x).to_string()).collect(),
        }
    }

    fn bonds() -> BTreeMap<String, NonNegI64> {
        [
            ("v0".to_string(), 70),
            ("v1".to_string(), 10),
            ("v2".to_string(), 10),
            ("v3".to_string(), 10),
        ]
        .into_iter()
        .map(|(sender, stake)| (sender, NonNegI64::try_from(stake).unwrap()))
        .collect()
    }

    #[test]
    fn m14_public_finalization_can_return_three_member_fringe_for_four_bonded_senders() {
        let mut map = BTreeMap::new();

        for (id, sender) in [("g0", "v0"), ("g1", "v1"), ("g2", "v2"), ("g3", "v3")] {
            map.insert(id.to_string(), msg(id, sender, 0, &[], &[id]));
        }

        let layer_one = ["a1", "b1", "c1", "d1"];
        map.insert("a1".into(), msg("a1", "v0", 1, &["g0"], &["g0", "a1"]));
        map.insert("b1".into(), msg("b1", "v1", 1, &["g1"], &["g1", "b1"]));
        map.insert("c1".into(), msg("c1", "v2", 1, &["g2"], &["g2", "c1"]));
        map.insert("d1".into(), msg("d1", "v3", 1, &["g3"], &["g3", "d1"]));

        let layer_one_seen = ["g0", "g1", "g2", "g3", "a1", "b1", "c1", "d1"];

        for (id, sender) in [("a2", "v0"), ("b2", "v1"), ("c2", "v2"), ("d2", "v3")] {
            let mut seen = layer_one_seen.to_vec();
            seen.push(id);
            map.insert(id.to_string(), msg(id, sender, 2, &layer_one, &seen));
        }

        let layer_two = ["a2", "b2", "c2", "d2"];
        let layer_two_seen = [
            "g0", "g1", "g2", "g3",
            "a1", "b1", "c1", "d1",
            "a2", "b2", "c2", "d2",
        ];

        for (id, sender) in [("a3", "v0"), ("b3", "v1"), ("c3", "v2")] {
            let mut seen = layer_two_seen.to_vec();
            seen.push(id);
            map.insert(id.to_string(), msg(id, sender, 3, &layer_two, &seen));
        }

        let justifications: BTreeSet<_> = ["a2", "a3", "b3", "c3"]
            .into_iter()
            .map(|id| map[id].clone())
            .collect();

        let finalizer = Finalizer::new(&map);
        let bonds = bonds();

        let min_msgs = vec![
            map["g0"].clone(),
            map["g0"].clone(),
            map["g1"].clone(),
            map["g2"].clone(),
        ];

        assert_eq!(min_msgs.len(), bonds.len());
        assert_eq!(
            min_msgs.iter().map(|m| m.sender.as_str()).collect::<Vec<_>>(),
            vec!["v0", "v0", "v1", "v2"]
        );
        assert!(finalizer.check_min_messages(&min_msgs, &bonds));

        let (_parent, new_fringe) =
            finalizer.calculate_finalization(&justifications, &bonds);

        let fringe = new_fringe.expect("pinned Finalizer should advance");
        let fringe_senders: BTreeSet<_> =
            fringe.iter().map(|m| m.sender.as_str()).collect();

        assert_eq!(fringe_senders, ["v0", "v1", "v2"].into_iter().collect());
        assert_eq!(fringe.len(), 3);
        assert_ne!(fringe_senders.len(), bonds.len());
        assert!(!fringe_senders.contains("v3"));
    }
}
