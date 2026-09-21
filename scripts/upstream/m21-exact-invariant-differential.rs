// M21 — exact invariant differential at the pinned Casper SDK boundary.
//
// The upstream SDK already contains invalid_justification_follows(), which checks
// distinct justification-sender coverage against the bonded sender set. This
// probe demonstrates that the same four-entry duplicate-sender shape has:
//   (a) four justification entries,
//   (b) only three distinct senders,
//   (c) an exact upstream predicate result of "invalid".
//
// M11.6/M12 establish separately that the active block-summary / ingress path
// accepts the same correctly formed duplicate-sender shape. Together, these
// probes pin the discrepancy to a concrete available predicate that is not
// enforced by the active summary path. This is not a claim that the predicate
// is necessarily the intended consensus fix.

#[cfg(test)]
mod m21_exact_invariant_differential {
    use super::*;
    use std::collections::{BTreeMap, BTreeSet};

    #[derive(Clone, Debug, PartialEq)]
    struct Msg {
        id: i32,
        sender: i32,
        seq: i64,
        block: i64,
        justifications: Vec<i32>,
        bonds: Vec<(i32, NonNegI64)>,
    }

    impl Msg {
        fn new(id: i32, sender: i32, seq: i64, block: i64) -> Self {
            Self {
                id,
                sender,
                seq,
                block,
                justifications: Vec::new(),
                bonds: Vec::new(),
            }
        }
    }

    struct Data;

    impl DagData<Msg, i32, i32, i32> for Data {
        fn mid(&self, m: &Msg) -> i32 { m.id }
        fn seq_num(&self, m: &Msg) -> i64 { m.seq }
        fn block_num(&self, m: &Msg) -> i64 { m.block }
        fn justifications(&self, m: &Msg) -> Vec<i32> { m.justifications.clone() }
        fn sender(&self, m: &Msg) -> i32 { m.sender }
        fn bonds_map(&self, m: &Msg) -> Vec<(i32, NonNegI64)> { m.bonds.clone() }
        fn sid(&self, s: &i32) -> i32 { *s }
    }

    struct View {
        msgs: BTreeMap<i32, Msg>,
    }

    impl DagView<Msg, i32, i32, i32> for View {
        fn seen_by(&self) -> Msg { unreachable!() }
        fn messages(&self) -> Vec<(Msg, Vec<Msg>)> { Vec::new() }
        fn load_message(&self, mid: &i32) -> Msg {
            self.msgs.get(mid).cloned().expect("missing fixture message")
        }
        fn load_sender(&self, sid: &i32) -> i32 { *sid }
    }

    fn fixture() -> (View, Msg, BTreeSet<i32>) {
        let bonded: BTreeSet<i32> = [0, 1, 2, 3].into_iter().collect();
        let bonds = bonded
            .iter()
            .map(|&s| (s, NonNegI64::try_from(25).unwrap()))
            .collect::<Vec<_>>();

        // Four entries, but v0 appears twice and v3 is absent.
        let ids = [10, 11, 12, 13];
        let senders = [0, 0, 1, 2];
        let msgs = ids
            .into_iter()
            .zip(senders)
            .map(|(id, sender)| {
                let mut m = Msg::new(id, sender, 0, 7);
                m.bonds = bonds.clone();
                m
            })
            .collect::<Vec<_>>();

        let mut candidate = Msg::new(99, 0, 1, 8);
        candidate.justifications = ids.to_vec();
        candidate.bonds = bonds;

        let view = View {
            msgs: msgs.into_iter().map(|m| (m.id, m)).collect(),
        };
        (view, candidate, bonded)
    }

    #[test]
    fn duplicate_entry_count_is_not_distinct_sender_coverage() {
        let (view, candidate, bonded) = fixture();
        let data = Data;

        let entries = data.justifications(&candidate);
        let senders: BTreeSet<i32> = entries
            .iter()
            .map(|id| data.sender(&view.load_message(id)))
            .collect();

        assert_eq!(entries.len(), bonded.len());
        assert_eq!(senders, [0, 1, 2].into_iter().collect());
        assert_ne!(senders, bonded);

        // This is the exact upstream SDK predicate, not a local reimplementation.
        assert!(invalid_justification_follows(
            &view,
            &data,
            &candidate,
            &bonded
        ));
    }

    #[test]
    fn complete_one_per_sender_shape_is_accepted_by_the_same_predicate() {
        let (mut view, mut candidate, bonded) = fixture();
        let data = Data;

        let v3 = Msg {
            id: 14,
            sender: 3,
            seq: 0,
            block: 7,
            justifications: Vec::new(),
            bonds: candidate.bonds.clone(),
        };
        view.msgs.insert(v3.id, v3);
        candidate.justifications = vec![10, 12, 13, 14];

        assert_eq!(candidate.justifications.len(), bonded.len());
        let senders: BTreeSet<i32> = candidate
            .justifications
            .iter()
            .map(|id| data.sender(&view.load_message(id)))
            .collect();
        assert_eq!(senders, bonded);

        assert!(!invalid_justification_follows(
            &view,
            &data,
            &candidate,
            &bonded
        ));
    }
}
