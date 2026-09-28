use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;

use rchain_block_storage::dag::finalizer::{Finalizer, Message};
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

fn build_duplicate_minimum_message_graph() -> (
    BTreeMap<String, Message<String, String>>,
    BTreeSet<Message<String, String>>,
) {
    let mut messages: BTreeMap<String, Message<String, String>> = BTreeMap::new();

    for (id, sender) in [("g0", "v0"), ("g1", "v1"), ("g2", "v2"), ("g3", "v3")] {
        messages.insert(
            id.to_string(),
            msg(id, sender, 0, &[], &[id]),
        );
    }

    messages.insert(
        "a1".into(),
        msg("a1", "v0", 1, &["g0"], &["a1", "g0"]),
    );
    messages.insert(
        "b1".into(),
        msg("b1", "v1", 1, &["g1"], &["b1", "g1"]),
    );
    messages.insert(
        "c1".into(),
        msg("c1", "v2", 1, &["g2"], &["c1", "g2"]),
    );
    messages.insert(
        "d1".into(),
        msg("d1", "v3", 1, &["g3"], &["d1", "g3"]),
    );

    let layer_one = ["a1", "b1", "c1", "d1"];
    let layer_one_seen = ["a1", "b1", "c1", "d1", "g0", "g1", "g2", "g3"];

    for (id, sender, own) in [
        ("a2", "v0", "a1"),
        ("b2", "v1", "b1"),
        ("c2", "v2", "c1"),
        ("d2", "v3", "d1"),
    ] {
        let _ = own;
        messages.insert(
            id.to_string(),
            msg(
                id,
                sender,
                2,
                &layer_one,
                &layer_one_seen.iter().chain([&id]).copied().collect::<Vec<_>>(),
            ),
        );
    }

    let layer_two = ["a2", "b2", "c2", "d2"];
    let layer_two_seen = [
        "a2", "b2", "c2", "d2",
        "a1", "b1", "c1", "d1",
        "g0", "g1", "g2", "g3",
    ];

    for (id, sender) in [("a3", "v0"), ("b3", "v1"), ("c3", "v2"), ("d3", "v3")] {
        messages.insert(
            id.to_string(),
            msg(
                id,
                sender,
                3,
                &layer_two,
                &layer_two_seen.iter().chain([&id]).copied().collect::<Vec<_>>(),
            ),
        );
    }

    let justifications: BTreeSet<_> = ["a2", "a3", "b3", "c3"]
        .into_iter()
        .map(|id| messages[id].clone())
        .collect();

    (messages, justifications)
}

#[test]
fn upstream_m11_5_duplicate_minimum_messages_pass_count_gate_and_finalize() {
    let (msg_map, justifications) = build_duplicate_minimum_message_graph();
    let finalizer = Finalizer::new(&msg_map);
    let bond_map = bonds();

    // This is the exact candidate minimum-message multiset produced by the
    // upstream self-parent walk:
    // a2 -> a1 -> g0, a3 -> a2 -> a1 -> g0,
    // b3 -> b2 -> b1 -> g1, c3 -> c2 -> c1 -> g2.
    let g0 = msg_map["g0"].clone();
    let g1 = msg_map["g1"].clone();
    let g2 = msg_map["g2"].clone();
    let min_msgs = vec![g0.clone(), g0.clone(), g1.clone(), g2.clone()];

    assert_eq!(min_msgs.len(), 4);
    assert_eq!(
        min_msgs.iter().map(|m| m.sender.as_str()).collect::<Vec<_>>(),
        vec!["v0", "v0", "v1", "v2"]
    );

    // Actual upstream Finalizer gate.
    assert!(
        finalizer.check_min_messages(&min_msgs, &bond_map),
        "upstream check_min_messages is count-only at this pinned commit"
    );

    // Actual upstream next-layer construction collapses duplicate sender keys.
    let next_layer = finalizer.calculate_next_layer(&min_msgs);
    assert_eq!(next_layer.len(), 3);
    assert_eq!(next_layer["v0"].id, "g0");
    assert_eq!(next_layer["v1"].id, "g1");
    assert_eq!(next_layer["v2"].id, "g2");
    assert!(!next_layer.contains_key("v3"));

    // Actual upstream support-map + Law-14 calculation.
    let prev_fringe = BTreeSet::new();
    let support = finalizer.calculate_next_fringe_support_map(
        &justifications,
        &next_layer,
        &prev_fringe,
    );
    assert_eq!(
        support.keys().cloned().collect::<BTreeSet<_>>(),
        ["v0".to_string(), "v1".to_string(), "v2".to_string()]
            .into_iter()
            .collect()
    );
    assert!(finalizer.calculate_fringe(&support, &bond_map));

    // Full public calculate_finalization path also advances the fringe.
    let (_parent_fringe, new_fringe) =
        finalizer.calculate_finalization(&justifications, &bond_map);
    let fringe = new_fringe.expect("the pinned upstream implementation should finalize");
    let fringe_ids: BTreeSet<_> = fringe.into_iter().map(|m| m.id).collect();
    assert_eq!(
        fringe_ids,
        ["a1".to_string(), "b1".to_string(), "c1".to_string()]
            .into_iter()
            .collect()
    );
}


#[test]
fn upstream_m11_5_repaired_distinct_sender_candidate_preserves_finalization() {
    let (msg_map, _original_justifications) = build_duplicate_minimum_message_graph();
    let finalizer = Finalizer::new(&msg_map);
    let bond_map = bonds();

    // This is the repair selected by the generic repair compiler:
    // replace a2 (v0) with d3 (v3) in the justification set.
    // The corresponding oldest self-parent messages are now one per bonded sender.
    let repaired_justifications: BTreeSet<_> = ["a3", "b3", "c3", "d3"]
        .into_iter()
        .map(|id| msg_map[id].clone())
        .collect();

    let min_msgs = vec![
        msg_map["g0"].clone(),
        msg_map["g1"].clone(),
        msg_map["g2"].clone(),
        msg_map["g3"].clone(),
    ];

    assert_eq!(min_msgs.len(), 4);
    assert_eq!(
        min_msgs.iter().map(|m| m.sender.as_str()).collect::<Vec<_>>(),
        vec!["v0", "v1", "v2", "v3"]
    );
    assert!(
        finalizer.check_min_messages(&min_msgs, &bond_map),
        "repaired candidate should pass the pinned upstream count gate"
    );

    let next_layer = finalizer.calculate_next_layer(&min_msgs);
    assert_eq!(next_layer.len(), 4);
    assert!(next_layer.contains_key("v0"));
    assert!(next_layer.contains_key("v1"));
    assert!(next_layer.contains_key("v2"));
    assert!(next_layer.contains_key("v3"));

    let prev_fringe = BTreeSet::new();
    let support = finalizer.calculate_next_fringe_support_map(
        &repaired_justifications,
        &next_layer,
        &prev_fringe,
    );
    assert!(
        finalizer.calculate_fringe(&support, &bond_map),
        "repair should preserve the Finalizer's ability to advance the fringe"
    );

    let (_parent_fringe, new_fringe) =
        finalizer.calculate_finalization(&repaired_justifications, &bond_map);
    let fringe = new_fringe.expect("repaired distinct-sender candidate should finalize");
    let fringe_ids: BTreeSet<_> = fringe.into_iter().map(|m| m.id).collect();
    assert_eq!(
        fringe_ids,
        [
            "a1".to_string(),
            "b1".to_string(),
            "c1".to_string(),
            "d1".to_string(),
        ]
        .into_iter()
        .collect()
    );

    // Emit a deterministic machine-readable receipt when CI asks for one.
    // The receipt binds the exact repair selected by the TypeScript compiler
    // to the observed native Finalizer before/after states.
    if let Ok(receipt_path) = std::env::var("M11_5_REPAIR_RECEIPT") {
        let receipt = concat!(
            "{\n",
            "  \"schema\": \"cbc-native-repair-replay/v1\",\n",
            "  \"upstreamRepository\": \"rchain-community/rchain-rust\",\n",
            "  \"upstreamCommit\": \"d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b\",\n",
            "  \"repairAction\": \"replace:a2->d3\",\n",
            "  \"before\": {\n",
            "    \"justifications\": [\"a2\", \"a3\", \"b3\", \"c3\"],\n",
            "    \"minimumMessageSenders\": [\"v0\", \"v0\", \"v1\", \"v2\"],\n",
            "    \"fringe\": [\"a1\", \"b1\", \"c1\"],\n",
            "    \"finalized\": true\n",
            "  },\n",
            "  \"after\": {\n",
            "    \"justifications\": [\"a3\", \"b3\", \"c3\", \"d3\"],\n",
            "    \"minimumMessageSenders\": [\"v0\", \"v1\", \"v2\", \"v3\"],\n",
            "    \"fringe\": [\"a1\", \"b1\", \"c1\", \"d1\"],\n",
            "    \"finalized\": true\n",
            "  }\n",
            "}\n"
        );
        if let Some(parent) = Path::new(&receipt_path).parent() {
            fs::create_dir_all(parent).expect("create native repair receipt directory");
        }
        fs::write(&receipt_path, receipt).expect("write native repair replay receipt");
    }
}
