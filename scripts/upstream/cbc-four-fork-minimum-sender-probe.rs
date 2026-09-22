// Identical, temporary source-level probe, appended to each pinned checkout's
// block-storage/src/dag/finalizer.rs. This does not patch production behavior.
// The input labels are from the source-reported M27 witness; the local four-
// message map is a reduced *admission-gate* fixture, NOT M27's full causal DAG.
#[cfg(test)]
mod aria_cbc_differential_v1 {
    use super::*;

    fn message(id: i32, sender: i32) -> Message<i32, i32> {
        Message {
            id,
            height: BlockHeight::zero(),
            sender,
            sender_seq: SeqNum::try_from(3).expect("valid sequence"),
            bonds_map: BTreeMap::new(),
            parents: BTreeSet::new(),
            fringe: BTreeSet::new(),
            seen: BTreeSet::from([id]),
        }
    }

    fn gates(senders: &[i32; 4], bonds: &BTreeMap<i32, NonNegI64>)
        -> (bool, usize, bool)
    {
        let messages: Vec<_> = (10..14)
            .zip(senders.iter())
            .map(|(id, sender)| message(id, *sender))
            .collect();
        let map: BTreeMap<_, _> = messages.iter().map(|m| (m.id, m.clone())).collect();
        let finalizer = Finalizer::new(&map);
        let accepted_count = finalizer.check_min_messages(&messages, bonds);
        let distinct_next_layer = finalizer.calculate_next_layer(&messages).len();
        let justifications: BTreeSet<_> = messages.into_iter().collect();
        let (_, new_fringe) = finalizer.calculate_finalization(&justifications, bonds);
        (accepted_count, distinct_next_layer, new_fringe.is_some())
    }

    #[test]
    fn identical_four_entry_bonded_sender_admission_fixture() {
        let csv = std::env::var("ARIA_CBC_M27_SENDERS").expect("same source-reported M27 sender fixture");
        let witness_sha = std::env::var("ARIA_CBC_M27_TRANSPORT_SHA256").expect("shared fixture digest");
        assert_eq!(witness_sha.len(), 64);
        assert!(witness_sha.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()));
        let labels: Vec<_> = csv.split(',').collect();
        assert_eq!(labels.len(), 4);
        let mut source_senders = [0i32; 4];
        for (index, label) in labels.into_iter().enumerate() {
            source_senders[index] = match label {
                "v0" => 0, "v1" => 1, "v2" => 2, "v3" => 3,
                _ => panic!("unknown validator label"),
            };
        }
        let distinct: BTreeSet<_> = source_senders.iter().copied().collect();
        assert_eq!(distinct.len(), 3, "M27 source-reported minimum witness must have three senders");
        assert_eq!(source_senders.iter().zip([0, 1, 2, 3])
            .filter(|(a, b)| **a != *b).count(), 1, "exactly one changed sender");
        let bonds: BTreeMap<i32, NonNegI64> = [(0, 70), (1, 10), (2, 10), (3, 10)]
            .into_iter().map(|(k, v)| (k, NonNegI64::try_from(v).expect("nonnegative stake")))
            .collect();
        let control = gates(&[0, 1, 2, 3], &bonds);
        let duplicate = gates(&source_senders, &bonds);
        assert_eq!(control.1, 4);
        assert_eq!(duplicate.1, 3);
        println!(
            "ARIA_CBC_DIFF_V1|fixture_sha256={}|control_count_gate={}|control_sender_count={}|control_local_fringe={}|duplicate_count_gate={}|duplicate_sender_count={}|duplicate_local_fringe={}",
            witness_sha, control.0, control.1, control.2, duplicate.0, duplicate.1, duplicate.2
        );
    }
}
