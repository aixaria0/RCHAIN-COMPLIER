#!/usr/bin/env python3
import subprocess
import sys
from pathlib import Path

PINNED = "51935310789a1a75a183ad0af7152e4eef450c88"

if len(sys.argv) != 2:
    raise SystemExit("usage: inject_rchain_attestation_pair_rust_gate.py <upstream-dir>")

root = Path(sys.argv[1]).resolve()
revision = subprocess.check_output(
    ["git", "-C", str(root), "rev-parse", "HEAD"], text=True
).strip()
if revision != PINNED:
    raise SystemExit(f"unexpected upstream revision: {revision}")

path = root / "node/src/runtime/node_runtime.rs"
text = path.read_text(encoding="utf-8")

sentinel = "fn paired_candidate_opens_c192_with_one_bounded_self_trigger()"
if sentinel in text:
    print("paired Rust gate already injected")
    raise SystemExit(0)

marker = "\n}\n\n#[cfg(test)]\nmod admin_bind_tests {"
if marker not in text:
    raise SystemExit("attest_warranted_tests boundary not found")

insertion = r'''
    #[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
    struct PairedAttestationGateState {
        last_remote_height: Option<i64>,
        own_latest_height: Option<i64>,
        self_triggered_round: Option<i64>,
    }

    fn paired_remote_request(
        me: &[u8],
        sender: &[u8],
        height: i64,
        state: &mut PairedAttestationGateState,
    ) -> bool {
        if sender == me {
            return false;
        }
        if state
            .last_remote_height
            .is_some_and(|last| height <= last)
        {
            return false;
        }

        let cadence_due = state.own_latest_height.map_or(true, |mine| {
            height - mine > rchain_block_storage::dag::liveness::LIVENESS_WINDOW
        });
        if !cadence_due {
            return false;
        }

        state.last_remote_height = Some(height);
        state.own_latest_height = Some(height);
        true
    }

    fn paired_stalled_round_self_trigger(
        round_height: i64,
        state: &mut PairedAttestationGateState,
    ) -> bool {
        if state.self_triggered_round == Some(round_height)
            || state.own_latest_height != Some(round_height)
        {
            return false;
        }

        state.self_triggered_round = Some(round_height);
        state.own_latest_height = Some(round_height + 1);
        true
    }

    #[test]
    fn paired_candidate_opens_c192_with_one_bounded_self_trigger() {
        let me = vec![1u8; 65];
        let peers: Vec<Vec<u8>> = (2..9u8).map(|i| vec![i; 65]).collect();
        let mut state = PairedAttestationGateState::default();

        let remote_requests = peers
            .iter()
            .filter(|peer| paired_remote_request(&me, peer, 1, &mut state))
            .count();
        assert_eq!(
            remote_requests, 1,
            "the measured same-height burst must still enqueue only one remote-driven request"
        );

        assert!(
            paired_stalled_round_self_trigger(1, &mut state),
            "a round sealed at height 1 needs one node-driven path above height 1"
        );
        assert!(
            !paired_stalled_round_self_trigger(1, &mut state),
            "the same stalled round may not self-trigger twice"
        );
        assert_eq!(state.own_latest_height, Some(2));
        assert_eq!(
            remote_requests + 1,
            2,
            "C192 advances with a constant two-request bound"
        );
    }

    #[test]
    fn paired_candidate_paces_c171_by_own_quiet() {
        let me = vec![1u8; 65];
        let peer = vec![2u8; 65];

        let mut same_height = PairedAttestationGateState::default();
        let burst = (0..7)
            .filter(|_| paired_remote_request(&me, &peer, 10, &mut same_height))
            .count();
        assert_eq!(burst, 1, "same-height fan-out must stay single-shot");

        let mut advancing = PairedAttestationGateState::default();
        let requests = (1..=36)
            .filter(|height| paired_remote_request(&me, &peer, *height, &mut advancing))
            .count();
        assert_eq!(
            requests, 6,
            "with LIVENESS_WINDOW=5, 36 advancing heights admit one request per six heights"
        );
    }

    #[test]
    fn paired_candidate_negative_controls_reject_one_sided_repairs() {
        let me = vec![1u8; 65];
        let peers: Vec<Vec<u8>> = (2..9u8).map(|i| vec![i; 65]).collect();

        let mut last = None;
        let non_strict = peers
            .iter()
            .filter(|_| {
                let warranted = last.map_or(true, |seen| 1 >= seen);
                if warranted {
                    last = Some(1);
                }
                warranted
            })
            .count();
        assert_eq!(
            non_strict, 7,
            "the naive non-strict height repair reopens the same-height burst"
        );

        let mut last = None;
        let strict_only = peers
            .iter()
            .filter(|peer| {
                let warranted = super::attest_warranted(&me, peer, 1, last);
                if warranted {
                    last = Some(1);
                }
                warranted
            })
            .count();
        assert_eq!(strict_only, 1);
        assert_eq!(
            last,
            Some(1),
            "without the self-trigger half there is still no path above the stalled round"
        );

        let mut last = None;
        let unpaced_advancing = (1..=36)
            .filter(|height| {
                let warranted = super::attest_warranted(&me, &peers[0], *height, last);
                if warranted {
                    last = Some(*height);
                }
                warranted
            })
            .count();
        assert_eq!(
            unpaced_advancing, 36,
            "a round escape alone leaves the advancing-height C171 rate unpaced"
        );
    }
'''

text = text.replace(marker, insertion + marker, 1)
path.write_text(text, encoding="utf-8")
print(path)
