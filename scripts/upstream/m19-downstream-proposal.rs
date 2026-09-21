// M19 — downstream proposal-fringe propagation witness.
//
// Injected into the exact pinned block-storage message_state implementation.
// Narrow question: when the latest justifications carry a three-member fringe,
// does normal create_message() preserve that fringe when no newer finalization
// is detected?

#[cfg(test)]
mod m19_downstream_proposal_fringe {
    use super::*;

    fn bonds() -> BTreeMap<i32, NonNegI64> {
        [(0, 25), (1, 25), (2, 25), (3, 25)]
            .into_iter()
            .map(|(k, v)| (k, NonNegI64::try_from(v).unwrap()))
            .collect()
    }

    fn msg(id: i32, sender: i32, seq: i64, fringe: &[i32]) -> Message<i32, i32> {
        Message {
            id,
            height: BlockHeight::try_from(seq).unwrap(),
            sender,
            sender_seq: SeqNum::try_from(seq).unwrap(),
            bonds_map: bonds(),
            parents: BTreeSet::new(),
            fringe: fringe.iter().copied().collect(),
            seen: fringe.iter().copied().chain([id]).collect(),
        }
    }

    #[test]
    fn subsequent_proposal_inherits_three_member_fringe() {
        let persisted_fringe = [11, 12, 13];

        // Four current justifications represent all four bonded senders,
        // while each carries the same already-persisted three-member fringe.
        // Their parent sets are empty, so there is no supporting evidence for
        // a newer fringe and create_message() must retain parent_fringe.
        let v0 = msg(21, 0, 2, &persisted_fringe);
        let v1 = msg(22, 1, 2, &persisted_fringe);
        let v2 = msg(23, 2, 2, &persisted_fringe);
        let v3 = msg(24, 3, 2, &persisted_fringe);

        let state = DagMessageState::empty()
            .insert_msg(&msg(11, 0, 1, &[]))
            .insert_msg(&msg(12, 1, 1, &[]))
            .insert_msg(&msg(13, 2, 1, &[]))
            .insert_msg(&msg(14, 3, 1, &[]))
            .insert_msg(&v0)
            .insert_msg(&v1)
            .insert_msg(&v2)
            .insert_msg(&v3);

        assert_eq!(state.latest_msgs.len(), 4);

        let justifications: BTreeSet<_> = state.latest_msgs.values().cloned().collect();
        let proposal = state.create_message(
            30,
            BlockHeight::try_from(3).unwrap(),
            0,
            SeqNum::try_from(3).unwrap(),
            bonds(),
            &justifications,
        );

        assert_eq!(
            proposal.fringe,
            persisted_fringe.into_iter().collect::<BTreeSet<_>>()
        );
        assert_eq!(proposal.fringe.len(), 3);
        assert!(!proposal.fringe.contains(&14));

        // Downstream impact boundary: normal proposal construction preserves
        // the under-cardinality fringe instead of repairing it.
        assert_eq!(proposal.parents.len(), 4);
        assert!(proposal.seen.contains(&30));
    }
}
