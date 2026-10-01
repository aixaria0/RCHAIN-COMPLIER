#!/usr/bin/env python3
import subprocess
import sys
from pathlib import Path

PINNED = "51935310789a1a75a183ad0af7152e4eef450c88"

if len(sys.argv) != 2:
    raise SystemExit("usage: inject_rchain_attestation_production_wiring.py <upstream-dir>")

root = Path(sys.argv[1]).resolve()
revision = subprocess.check_output(
    ["git", "-C", str(root), "rev-parse", "HEAD"], text=True
).strip()
if revision != PINNED:
    raise SystemExit(f"unexpected upstream revision: {revision}")

path = root / "node/src/runtime/node_runtime.rs"
text = path.read_text(encoding="utf-8")

sentinel = "fn stalled_round_self_trigger_warranted("
if sentinel in text:
    print("production wiring already injected")
    raise SystemExit(0)

old_helper = '''fn attest_warranted(
    me: &[u8],
    sender: &[u8],
    height: i64,
    last_attested_height: Option<i64>,
) -> bool {
    sender != me && last_attested_height.map_or(true, |last| height > last)
}
'''

new_helper = old_helper + r'''
fn attestation_cadence_due(height: i64, own_latest_height: Option<i64>) -> bool {
    own_latest_height.map_or(true, |mine| {
        height - mine > rchain_block_storage::dag::liveness::LIVENESS_WINDOW
    })
}

fn stalled_round_self_trigger_warranted(
    observed_height: i64,
    round_height: i64,
    tip_height: i64,
    own_latest_height: Option<i64>,
    last_self_trigger_round: Option<i64>,
) -> bool {
    observed_height == round_height
        && tip_height == round_height
        && own_latest_height == Some(round_height)
        && last_self_trigger_round != Some(round_height)
}
'''

if old_helper not in text:
    raise SystemExit("attest_warranted helper boundary not found")
text = text.replace(old_helper, new_helper, 1)

start_marker = "    let attest_on_new_blocks: Option<Arc<dyn Fn(&BlockMessage) + Send + Sync>> = match ("
end_marker = "    // Block receiver + processor streams (spawned internally)."
start = text.find(start_marker)
end = text.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit("attestation tap boundary not found")

replacement = r'''    let attest_on_new_blocks: Option<Arc<dyn Fn(&BlockMessage) + Send + Sync>> = match (
        &proposer_parts,
        conf.attest_on_new_blocks && !conf.no_attest_on_new_blocks,
        validator_opt,
    ) {
        (Some(pp), true, Some(identity)) => {
            let tap_log = log.clone();
            let tap_tx = pp.queue_tx.clone();
            let tap_dag = parts.dag.clone();
            let me: Vec<u8> = identity.public_key.bytes().to_vec();
            let me_validator =
                rchain_models::validator::Validator::from_slice(identity.public_key.bytes());
            let last_attested_height: Arc<Mutex<Option<i64>>> = Arc::new(Mutex::new(None));
            let last_self_trigger_round: Arc<Mutex<Option<i64>>> = Arc::new(Mutex::new(None));

            Some(Arc::new(move |block: &BlockMessage| {
                let height = i64::from(block.block_number);
                let sender = block.sender.as_bytes().to_vec();
                if sender == me {
                    return;
                }

                let tap_log = tap_log.clone();
                let tap_tx = tap_tx.clone();
                let tap_dag = tap_dag.clone();
                let me = me.clone();
                let me_validator = me_validator.clone();
                let last_attested_height = last_attested_height.clone();
                let last_self_trigger_round = last_self_trigger_round.clone();

                tokio::spawn(async move {
                    // This callback runs from the validated queue after BlockProcessor has inserted
                    // the block into the DAG, so these reads are the post-insert view.
                    let dag_repr = tap_dag.get_representation().await;
                    let dag_state = &dag_repr.dag_message_state;
                    let own_latest_height = dag_state
                        .latest_msgs
                        .get(&me_validator)
                        .map(|m| i64::from(m.height));
                    let tip_height = dag_state
                        .latest_msgs
                        .values()
                        .map(|m| i64::from(m.height))
                        .max()
                        .unwrap_or(0);
                    let round_height = i64::from(dag_state.round_height);

                    let remote_due = {
                        let mut last = last_attested_height
                            .lock()
                            .unwrap_or_else(|p| p.into_inner());
                        if attest_warranted(&me, &sender, height, *last)
                            && attestation_cadence_due(height, own_latest_height)
                        {
                            *last = Some(height);
                            true
                        } else {
                            false
                        }
                    };

                    let self_due = {
                        let mut last_round = last_self_trigger_round
                            .lock()
                            .unwrap_or_else(|p| p.into_inner());
                        if stalled_round_self_trigger_warranted(
                            height,
                            round_height,
                            tip_height,
                            own_latest_height,
                            *last_round,
                        ) {
                            *last_round = Some(round_height);
                            true
                        } else {
                            false
                        }
                    };

                    if !remote_due && !self_due {
                        return;
                    }

                    let (otx, _orx) = tokio::sync::oneshot::channel();
                    if let Err(e) = tap_tx.try_send((true, otx)) {
                        if self_due {
                            let mut last_round = last_self_trigger_round
                                .lock()
                                .unwrap_or_else(|p| p.into_inner());
                            if *last_round == Some(round_height) {
                                *last_round = None;
                            }
                        }
                        tap_log.warn(
                            LogSource::new("coop.rchain.node.runtime.Setup"),
                            &format!(
                                "attest request not queued ({e}) — this validator will not attest to the new block"
                            ),
                        );
                    }
                });
            }))
        }
        _ => None,
    };

'''

text = text[:start] + replacement + text[end:]

old_use = "    use super::attest_warranted;\n"
new_use = '''    use super::{
        attest_warranted, attestation_cadence_due, stalled_round_self_trigger_warranted,
    };
'''
if old_use not in text:
    raise SystemExit("attest_warranted_tests import not found")
text = text.replace(old_use, new_use, 1)

module_end = "\n}\n\n#[cfg(test)]\nmod admin_bind_tests {"
if module_end not in text:
    raise SystemExit("attest_warranted_tests closing boundary not found")

tests = r'''
    #[test]
    fn paired_production_gate_paces_advancing_remote_heights() {
        let mut own_latest = None;
        let admitted = (1..=36)
            .filter(|height| {
                if attestation_cadence_due(*height, own_latest) {
                    own_latest = Some(*height);
                    true
                } else {
                    false
                }
            })
            .count();
        assert_eq!(
            admitted, 6,
            "the production cadence admits one request per LIVENESS_WINDOW + 1 heights"
        );
    }

    #[test]
    fn paired_production_gate_self_triggers_one_closed_stalled_round_once() {
        assert!(stalled_round_self_trigger_warranted(
            1,
            1,
            1,
            Some(1),
            None
        ));
        assert!(!stalled_round_self_trigger_warranted(
            1,
            1,
            1,
            Some(1),
            Some(1)
        ));
        assert!(!stalled_round_self_trigger_warranted(
            2,
            1,
            2,
            Some(1),
            None
        ));
        assert!(!stalled_round_self_trigger_warranted(
            1,
            0,
            1,
            Some(1),
            None
        ));
    }

    #[test]
    fn paired_production_gate_keeps_same_height_fanout_single_shot() {
        let me = vec![1u8; 65];
        let peers: Vec<Vec<u8>> = (2..9u8).map(|i| vec![i; 65]).collect();
        let mut last = None;
        let remote_requests = peers
            .iter()
            .filter(|peer| {
                let warranted = attest_warranted(&me, peer, 1, last)
                    && attestation_cadence_due(1, None);
                if warranted {
                    last = Some(1);
                }
                warranted
            })
            .count();
        assert_eq!(remote_requests, 1);
        assert!(
            stalled_round_self_trigger_warranted(1, 1, 1, Some(1), None),
            "after the measured round closes at height 1, exactly one node-driven trigger is due"
        );
    }
'''

text = text.replace(module_end, tests + module_end, 1)
path.write_text(text, encoding="utf-8")
print(path)
