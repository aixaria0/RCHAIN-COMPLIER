// Appended into rchain-community/rchain-rust@9f06172567d28e306a8649f4d85ba6d9c1cf2c75
// rholang/src/native_state.rs by CI. This executes the real Rust NativeSystemState.
#[cfg(test)]
mod aria_slashing_live_probe {
    use super::*;
    use std::collections::{BTreeMap, BTreeSet};
    use std::sync::Arc;

    fn validator(byte: u8) -> Validator {
        Validator::from_slice(&[byte; 65])
    }

    async fn fixture(epoch_length: i64, quarantine_length: i64) -> NativeSystemState {
        let v = validator(1);
        let bonds = BTreeMap::from([(v, NonNegI64::try_from(40).unwrap())]);
        let trusted = BTreeSet::from([v]);
        let native = NativeSystemState::new(Arc::new(InMemNativeStore::empty()));
        native.install_genesis(&PosGenesis {
            bonds,
            trusted,
            params: PosParams {
                minimum_bond: 1,
                maximum_bond: 1_000,
                epoch_length,
                quarantine_length,
                number_of_active_validators: 0,
            },
        }).unwrap();
        native
    }

    #[tokio::test]
    async fn reproducer_stale_pending_withdrawal_survives_slash_and_ejects_rebond() {
        let native = fixture(10, 20).await;
        let v = validator(1);

        // Stage a withdrawal in the middle of the epoch.
        native.withdraw(&v, 5).await.unwrap().unwrap();
        assert!(native.pending_withdrawers().await.unwrap().contains_key(&v));

        // Real slash implementation claims to cancel pending withdrawal.
        native.slash(&v).await.unwrap().unwrap();
        assert!(!native.bonds().await.unwrap().contains_key(&v));
        assert!(!native.active().await.unwrap().contains_key(&v));

        // Reproducer checkpoint: the current implementation removes the key only
        // from the local map but does not persist the mutated pending map.
        assert!(
            native.pending_withdrawers().await.unwrap().contains_key(&v),
            "source behavior changed: pending withdrawal is now persisted as cancelled"
        );

        // Re-fund and re-bond before the next epoch boundary. The validator is
        // still trusted, so this is accepted by the current bond path.
        let addr = native.vault_address(&v).unwrap();
        native.set_vault_balance(&addr, NonNegI64::try_from(40).unwrap());
        native.bond(&v, NonNegI64::try_from(40).unwrap(), 6)
            .await.unwrap().unwrap();
        assert!(native.bonds().await.unwrap().contains_key(&v));

        // At the next boundary the stale pre-slash withdrawal request acts on
        // the new bond and moves it out of the pool without a new withdraw call.
        native.close_block(10).await.unwrap().unwrap();
        assert!(
            !native.bonds().await.unwrap().contains_key(&v),
            "stale request did not eject the newly re-bonded validator"
        );
        let claims = native.withdrawers().await.unwrap();
        assert!(
            claims.contains_key(&v),
            "stale request did not create a withdrawal claim for the new bond"
        );
        assert!(
            !native.active().await.unwrap().contains_key(&v),
            "validator remained active despite stale-request ejection"
        );
    }

    #[tokio::test]
    async fn negative_control_slash_without_pending_request_does_not_poison_rebond() {
        let native = fixture(10, 20).await;
        let v = validator(1);

        native.slash(&v).await.unwrap().unwrap();
        assert!(native.pending_withdrawers().await.unwrap().is_empty());

        let addr = native.vault_address(&v).unwrap();
        native.set_vault_balance(&addr, NonNegI64::try_from(40).unwrap());
        native.bond(&v, NonNegI64::try_from(40).unwrap(), 6)
            .await.unwrap().unwrap();
        native.close_block(10).await.unwrap().unwrap();

        assert!(
            native.bonds().await.unwrap().contains_key(&v),
            "fresh re-bond should survive the boundary when no stale request exists"
        );
    }

    #[tokio::test]
    async fn conservation_control_slash_moves_bond_to_coop_once() {
        let native = fixture(10, 20).await;
        let v = validator(1);

        let before_staking = i64::from(native.pos_vault_balance().await.unwrap());
        let before_coop = i64::from(native.coop_balance().await.unwrap());

        native.slash(&v).await.unwrap().unwrap();

        let after_staking = i64::from(native.pos_vault_balance().await.unwrap());
        let after_coop = i64::from(native.coop_balance().await.unwrap());

        assert_eq!(before_staking + before_coop, after_staking + after_coop);
        assert_eq!(before_staking - after_staking, 40);
        assert_eq!(after_coop - before_coop, 40);

        // A repeated direct call must not confiscate twice.
        native.slash(&v).await.unwrap().unwrap();
        assert_eq!(i64::from(native.pos_vault_balance().await.unwrap()), after_staking);
        assert_eq!(i64::from(native.coop_balance().await.unwrap()), after_coop);
    }

    #[tokio::test]
    async fn reproducer_slash_leaves_committed_rewards_behind() {
        let native = fixture(10, 20).await;
        let v = validator(1);

        native.set_committed_rewards(&BTreeMap::from([
            (v, NonNegI64::try_from(7).unwrap())
        ]));
        native.slash(&v).await.unwrap().unwrap();

        let committed = native.committed_rewards().await.unwrap();
        assert_eq!(
            i64::from(committed[&v]),
            7,
            "current Rust slash leaves the pre-slash committed reward entry intact"
        );
    }

    #[tokio::test]
    async fn reproducer_stale_committed_reward_can_follow_a_rebond_into_later_payout() {
        let native = fixture(10, 0).await;
        let v = validator(1);

        native.set_committed_rewards(&BTreeMap::from([
            (v, NonNegI64::try_from(7).unwrap())
        ]));
        native.slash(&v).await.unwrap().unwrap();
        assert_eq!(i64::from(native.committed_rewards().await.unwrap()[&v]), 7);

        // New stake plus enough legitimate staking-vault liquidity to cover the
        // stale committed claim if the implementation carries it forward.
        let addr = native.vault_address(&v).unwrap();
        native.set_vault_balance(&addr, NonNegI64::try_from(40).unwrap());
        native.bond(&v, NonNegI64::try_from(40).unwrap(), 6)
            .await.unwrap().unwrap();
        native.credit_pos_vault(7).await.unwrap();

        // Fresh withdrawal after re-bond. At boundary 10 it becomes a claim;
        // at boundary 20 it is payable. The old committed entry is still keyed
        // to the same validator and is therefore included in the payout path.
        native.withdraw(&v, 6).await.unwrap().unwrap();
        native.close_block(10).await.unwrap().unwrap();
        native.close_block(20).await.unwrap().unwrap();

        let paid = native.vault_balance(&addr).await.unwrap().unwrap();
        assert_eq!(
            i64::from(paid),
            47,
            "40 new bond + 7 pre-slash committed reward reached the later withdrawal payout"
        );
    }

}
