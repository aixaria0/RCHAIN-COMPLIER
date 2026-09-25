// M20 — fork-sensitive downstream finality divergence witness.
//
// Injected into the exact pinned block-storage message_state implementation.
// Narrow question: can two locally consistent views, each carrying an
// under-cardinality fringe, propagate different finalized closures through the
// normal create_message() path? This is an impact characterization test, not a
// claim of live-network conflicting finality.

#[cfg(test)]
mod m20_fork_sensitive_finality {
    use super::*;

    fn bonds() -> BTreeMap<i32, NonNegI64> {
        [(0, 25), (1, 25), (2, 25), (3, 25)]
            .into_iter()
            .map(|(k, v)| (k, NonNegI64::try_from(v).unwrap()))
            .collect()
    }

    fn msg(id: i32, sender: i32, seq: i64, fringe: &[i32], seen: &[i32]) -> Message<i32, i32> {
        Message {
            id,
            height: BlockHeight::try_from(seq).unwrap(),
            sender,
            sender_seq: SeqNum::try_from(seq).unwrap(),
            bonds_map: bonds(),
            parents: BTreeSet::new(),
            fringe: fringe.iter().copied().collect(),
            seen: seen.iter().copied().collect(),
        }
    }

    fn view(
        state: &DagMessageState<i32, i32>,
        ids: &[i32],
    ) -> BTreeSet<Message<i32, i32>> {
        ids.iter().map(|id| state.msg_map[id].clone()).collect()
    }

    #[test]
    fn under_cardinality_views_propagate_different_finalized_closures() {
        // Two competing three-member fringes at the same height. Each omits a
        // different bonded validator's branch.
        let fringe_a = [11, 12, 13];
        let fringe_b = [11, 12, 14];

        let state = DagMessageState::empty()
            .insert_msg(&msg(11, 0, 2, &[], &[11]))
            .insert_msg(&msg(12, 1, 2, &[], &[12]))
            .insert_msg(&msg(13, 2, 2, &[], &[13]))
            .insert_msg(&msg(14, 3, 2, &[], &[14]))
            .insert_msg(&msg(21, 0, 3, &fringe_a, &[11, 12, 13, 21]))
            .insert_msg(&msg(22, 1, 3, &fringe_a, &[11, 12, 13, 22]))
            .insert_msg(&msg(23, 2, 3, &fringe_a, &[11, 12, 13, 23]))
            .insert_msg(&msg(24, 3, 3, &fringe_a, &[11, 12, 13, 24]))
            .insert_msg(&msg(31, 0, 3, &fringe_b, &[11, 12, 14, 31]))
            .insert_msg(&msg(32, 1, 3, &fringe_b, &[11, 12, 14, 32]))
            .insert_msg(&msg(33, 2, 3, &fringe_b, &[11, 12, 14, 33]))
            .insert_msg(&msg(34, 3, 3, &fringe_b, &[11, 12, 14, 34]));

        let view_a = view(&state, &[21, 22, 23, 24]);
        let view_b = view(&state, &[31, 32, 33, 34]);

        // Both views have complete four-sender justification coverage, but the
        // carried fringe itself is only three messages.
        assert_eq!(view_a.len(), 4);
        assert_eq!(view_b.len(), 4);
        assert_eq!(
            view_a.iter().map(|m| m.sender).collect::<BTreeSet<_>>(),
            [0, 1, 2, 3].into_iter().collect()
        );
        assert_eq!(
            view_b.iter().map(|m| m.sender).collect::<BTreeSet<_>>(),
            [0, 1, 2, 3].into_iter().collect()
        );

        let proposal_a = state.create_message(
            40,
            BlockHeight::try_from(4).unwrap(),
            0,
            SeqNum::try_from(4).unwrap(),
            bonds(),
            &view_a,
        );
        let proposal_b = state.create_message(
            41,
            BlockHeight::try_from(4).unwrap(),
            0,
            SeqNum::try_from(4).unwrap(),
            bonds(),
            &view_b,
        );

        assert_eq!(proposal_a.fringe, fringe_a.into_iter().collect());
        assert_eq!(proposal_b.fringe, fringe_b.into_iter().collect());
        assert_ne!(proposal_a.fringe, proposal_b.fringe);

        // The downstream finalized closure follows the propagated fringe.
        let finalized_a: BTreeSet<_> = proposal_a
            .fringe
            .iter()
            .flat_map(|id| state.msg_map[id].seen.iter().copied())
            .collect();
        let finalized_b: BTreeSet<_> = proposal_b
            .fringe
            .iter()
            .flat_map(|id| state.msg_map[id].seen.iter().copied())
            .collect();

        assert!(finalized_a.contains(&13));
        assert!(!finalized_a.contains(&14));
        assert!(finalized_b.contains(&14));
        assert!(!finalized_b.contains(&13));

        // Impact boundary: the implementation can propagate two different
        // under-cardinality finality closures from two locally consistent views.
        // This is evidence of fork-sensitive state selection, not by itself
        // evidence of a live conflicting-finality attack.
    }
}
