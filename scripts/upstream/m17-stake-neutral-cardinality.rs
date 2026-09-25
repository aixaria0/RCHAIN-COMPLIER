// M17 — stake-neutral fringe-cardinality witness.
//
// The duplicate-minimum shape is not dependent on a concentrated 70/10/10/10
// bond distribution. With four equal 25/25/25/25 validators, three senders
// still form a strict >2/3 stake supermajority.

#[cfg(test)]
mod m17_stake_neutral_cardinality {
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
    fn equal_stake_four_validator_case_still_returns_three_sender_fringe() {
        let bonds: BTreeMap<String, NonNegI64> = [
            ("v0", 25), ("v1", 25), ("v2", 25), ("v3", 25),
        ]
        .into_iter()
        .map(|(s, stake)| (s.to_string(), NonNegI64::try_from(stake).unwrap()))
        .collect();

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
        let min_msgs = vec![
            map["g0"].clone(),
            map["g0"].clone(),
            map["g1"].clone(),
            map["g2"].clone(),
        ];

        assert!(finalizer.check_min_messages(&min_msgs, &bonds));

        let (_parent, new_fringe) =
            finalizer.calculate_finalization(&justifications, &bonds);
        let fringe = new_fringe.expect("equal-stake candidate should finalize");

        let senders: BTreeSet<_> = fringe.iter().map(|m| m.sender.as_str()).collect();
        assert_eq!(senders, ["v0", "v1", "v2"].into_iter().collect());
        assert_eq!(fringe.len(), 3);

        // 75/100 is strictly greater than 2/3.
        assert!(3 * 75 > 2 * 100);
    }
}
