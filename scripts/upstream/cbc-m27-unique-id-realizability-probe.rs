// M27 ID-realizability audit: the research search enumerates ordered tuples,
// while actual Finalizer::calculate_finalization takes a BTreeSet of Messages.
// This test uses the *same id->sender pairs* as the selected M27 report, checks
// the actual finalizer's cardinality admission after set deduplication, and
// DOES NOT claim a full causal DAG was replayed.
#[cfg(test)]
mod aria_m27_identity_realizability_v1 {
    use super::*;
    #[test]
    fn selected_tuple_can_enter_actual_unique_justification_set() {
        let ids_env = std::env::var("ARIA_M27_JUSTIFICATION_IDS").expect("source-reported IDs required");
        let senders_env = std::env::var("ARIA_M27_SENDERS").expect("source-reported sender labels required");
        let fingerprint = std::env::var("ARIA_M27_FIXTURE_SHA256").expect("same research-derived fixture required");
        assert_eq!(fingerprint.len(), 64);
        assert!(fingerprint.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()));
        let ids: Vec<_> = ids_env.split(',').collect();
        let senders: Vec<_> = senders_env.split(',').collect();
        assert_eq!(ids.len(), 4);
        assert_eq!(senders.len(), 4);
        let mut incoming = Vec::new();
        for (id, sender) in ids.iter().zip(senders.iter()) {
            let (code, sender_id) = match (*id, *sender) {
                ("a3", "v0") => (30, 0), ("b3", "v1") => (31, 1),
                ("c3", "v2") => (32, 2), ("d3", "v3") => (33, 3),
                _ => panic!("M27 justification/sender mapping is not valid"),
            };
            incoming.push(Message {
                id: code,
                height: BlockHeight::zero(),
                sender: sender_id,
                sender_seq: SeqNum::try_from(3i64).expect("valid sender sequence"),
                bonds_map: BTreeMap::new(),
                parents: BTreeSet::new(),
                fringe: BTreeSet::new(),
                seen: BTreeSet::from([code]),
            });
        }
        let unique_justifications: BTreeSet<_> = incoming.into_iter().collect();
        let bonds: BTreeMap<i32, NonNegI64> = [
            (0, 70), (1, 10), (2, 10), (3, 10),
        ].into_iter().map(|(sender, stake)|
            (sender, NonNegI64::try_from(stake).expect("valid bond"))).collect();
        let msg_map: BTreeMap<_, _> = unique_justifications.iter()
            .map(|message| (message.id, message.clone())).collect();
        let finalizer = Finalizer::new(&msg_map);
        let retained: Vec<_> = unique_justifications.iter().cloned().collect();
        let gate = finalizer.check_min_messages(&retained, &bonds);
        let next_layer = finalizer.calculate_next_layer(&retained);
        let representable_as_four_unique_ids = retained.len() == 4;
        println!(
            "ARIA_M27_REALIZABILITY_V1|fixture_sha256={}|tuple_entries={}|unique_message_ids={}|representable_as_four_unique_ids={}|post_set_count_gate={}|distinct_sender_count={}",
            fingerprint, ids.len(), retained.len(), representable_as_four_unique_ids, gate,
            next_layer.len()
        );
        // Never hardcode the expected research outcome: this control must
        // remain successful if a later pinned report uses four distinct IDs.
        assert_eq!(gate, retained.len() == bonds.len(),
            "actual gate must reflect the post-deduplication input count");
    }
}
