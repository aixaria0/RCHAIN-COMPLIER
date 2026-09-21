// M19 — downstream proposal-fringe propagation witness.
//
// Injected into the exact pinned block-storage message_state implementation.
// The test asks a narrow impact question: once a three-member fringe has been
// produced, does the normal DagMessageState::create_message path inherit that
// under-cardinality fringe into a subsequent proposal when no newer finalization
// is detected?

#[cfg(test)]
mod m19_downstream_proposal_fringe {
    use super::*;
    use rchain_shared::refined::{BlockHeight, NonNegI64, SeqNum};

    fn validator(byte: u8) -> Validator {
        Validator::new([byte; 65])
    }

    fn bonds() -> BTreeMap<Validator, NonNegI64> {
        BTreeMap::from([
            (validator(0), NonNegI64::try_from(25).unwrap()),
            (validator(1), NonNegI64::try_from(25).unwrap()),
            (validator(2), NonNegI64::try_from(25).unwrap()),
            (validator(3), NonNegI64::try_from(25).unwrap()),
        ])
    }

    fn msg(
        id: u8,
        sender: u8,
        seq: i64,
        parents: &[u8],
        fringe: &[u8],
        seen: &[u8],
    ) -> Message<u8, Validator> {
        Message {
            id,
            height: BlockHeight::try_from(seq).unwrap(),
            sender: validator(sender),
            sender_seq: SeqNum::try_from(seq).unwrap(),
            bonds_map: bonds(),
            parents: parents.iter().copied().collect(),
            fringe: fringe.iter().copied().collect(),
            seen: seen.iter().copied().collect(),
        }
    }

    #[test]
    fn subsequent_proposal_inherits_three_member_fringe() {
        let persisted_fringe = [11u8, 12u8, 13u8];
        let seen = [1u8, 2u8, 3u8, 4u8, 11u8, 12u8, 13u8];

        // Four bonded validators are all present in latest_msgs, but the
        // previously finalized fringe contains only v0/v1/v2 messages.
        let v0 = msg(21, 0, 2, &[], &persisted_fringe, &seen);
        let v1 = msg(22, 1, 2, &[], &persisted_fringe, &seen);
        let v2 = msg(23, 2, 2, &[], &persisted_fringe, &seen);
        let v3 = msg(24, 3, 2, &[], &persisted_fringe, &seen);

        let state = DagMessageState::empty()
            .insert_msg(&msg(11, 0, 1, &[], &[], &[11]))
            .insert_msg(&msg(12, 1, 1, &[], &[], &[12]))
            .insert_msg(&msg(13, 2, 1, &[], &[], &[13]))
            .insert_msg(&msg(14, 3, 1, &[], &[], &[14]))
            .insert_msg(&v0)
            .insert_msg(&v1)
            .insert_msg(&v2)
            .insert_msg(&v3);

        assert_eq!(state.latest_msgs.len(), 4);

        let justifications: BTreeSet<_> = state.latest_msgs.values().cloned().collect();
        let proposal = state.create_message(
            30,
            BlockHeight::try_from(3).unwrap(),
            validator(0),
            SeqNum::try_from(3).unwrap(),
            bonds(),
            &justifications,
        );

        let inherited: BTreeSet<_> = proposal.fringe.clone();
        assert_eq!(
            inherited,
            persisted_fringe.into_iter().collect::<BTreeSet<_>>()
        );
        assert_eq!(inherited.len(), 3);
        assert!(!inherited.contains(&14));

        // This is the downstream impact boundary: a subsequent proposal
        // carries the under-cardinality fringe forward rather than repairing it.
        assert_eq!(proposal.parents.len(), 4);
        assert!(proposal.seen.contains(&30));
    }
}
