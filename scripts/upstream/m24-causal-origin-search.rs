// M24 — causal-origin search for under-cardinality fringes.
//
// Question: starting from a clean one-message-per-bonded-validator DAG, can
// the real proposer constructor itself generate a 1..N-1-member fringe?
// This searches only the normal proposer shape: each step uses
// create_msg_and_update_sender(), which justifies the current latest message
// from every sender.

#[cfg(test)]
mod m24_causal_origin_search {
    use super::*;

    fn bonds() -> BTreeMap<i32, NonNegI64> {
        [(0, 25), (1, 25), (2, 25), (3, 25)]
            .into_iter()
            .map(|(k, v)| (k, NonNegI64::try_from(v).unwrap()))
            .collect()
    }

    fn seed(id: i32, sender: i32) -> Message<i32, i32> {
        Message {
            id,
            height: BlockHeight::zero(),
            sender,
            sender_seq: SeqNum::zero(),
            bonds_map: bonds(),
            parents: BTreeSet::new(),
            fringe: BTreeSet::new(),
            seen: [id].into_iter().collect(),
        }
    }

    fn msg_id(sender: i32, height: BlockHeight, seq: SeqNum) -> i32 {
        sender * 10_000 + i64::from(height) as i32 * 100 + i64::from(seq) as i32
    }

    fn search_sequences(
        state: DagMessageState<i32, i32>,
        remaining: usize,
        checked: &mut usize,
    ) -> Option<(Vec<i32>, Message<i32, i32>)> {
        if remaining == 0 {
            return None;
        }

        for creator in 0..4 {
            let before = state.clone();
            let (next, msg) = before
                .create_msg_and_update_sender(&creator, |sender, height| {
                    let seq = before
                        .latest_msgs
                        .get(sender)
                        .map(|m| m.sender_seq + NonNegI64::one())
                        .unwrap_or_else(SeqNum::zero);
                    msg_id(*sender, height, seq)
                })
                .expect("clean latest view must produce a proposal");

            *checked += 1;
            let fringe_len = msg.fringe.len();
            if fringe_len > 0 && fringe_len < 4 {
                return Some((vec![creator], msg));
            }

            if remaining > 1 {
                if let Some((mut suffix, witness)) =
                    search_sequences(next.clone(), remaining - 1, checked)
                {
                    suffix.insert(0, creator);
                    return Some((suffix, witness));
                }
            }
        }

        None
    }

    #[test]
    fn m24_clean_proposer_search_does_not_spontaneously_create_under_cardinality_fringe() {
        let initial = DagMessageState::empty()
            .insert_msg(&seed(100, 0))
            .insert_msg(&seed(101, 1))
            .insert_msg(&seed(102, 2))
            .insert_msg(&seed(103, 3));

        let mut checked = 0usize;
        let witness = search_sequences(initial, 6, &mut checked);

        assert!(
            witness.is_none(),
            "normal proposer schedule generated an under-cardinality fringe: {:?}",
            witness.map(|(schedule, msg)| (schedule, msg.fringe))
        );

        assert_eq!(
            checked,
            5460,
            "the bounded exhaustive search should cover 4^1 + ... + 4^6 schedules"
        );
    }
}
