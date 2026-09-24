// Appended after the counterfactual state-cleanup patch in CI.
// These are remediation controls against the same pinned Rust revision.
#[cfg(test)]
mod aria_slashing_fix_control {
    use super::*;
    use std::collections::{BTreeMap, BTreeSet};
    use std::sync::Arc;

    fn validator(byte: u8) -> Validator { Validator::from_slice(&[byte; 65]) }

    async fn fixture() -> NativeSystemState {
        let v = validator(1);
        let native = NativeSystemState::new(Arc::new(InMemNativeStore::empty()));
        native.install_genesis(&PosGenesis {
            bonds: BTreeMap::from([(v, NonNegI64::try_from(40).unwrap())]),
            trusted: BTreeSet::from([v]),
            params: PosParams {
                minimum_bond: 1, maximum_bond: 1_000,
                epoch_length: 10, quarantine_length: 0,
                number_of_active_validators: 0,
            },
        }).unwrap();
        native
    }

    async fn earn_seven(native: &NativeSystemState, v: &Validator) {
        let payer = PublicKey::new(vec![9u8; 65]);
        let payer_addr = RevAddress::from_public_key(&payer).unwrap().to_base58();
        native.set_vault_balance(&payer_addr, NonNegI64::try_from(7).unwrap());
        native.pre_charge(&payer, 7).await.unwrap().unwrap();
        native.close_block(10).await.unwrap().unwrap();
        assert_eq!(i64::from(native.committed_rewards().await.unwrap()[v]), 7);
    }

    #[tokio::test]
    async fn fixed_slash_persists_pending_cancellation() {
        let native = fixture().await;
        let v = validator(1);
        native.withdraw(&v, 5).await.unwrap().unwrap();
        native.slash(&v).await.unwrap().unwrap();
        assert!(!native.pending_withdrawers().await.unwrap().contains_key(&v));

        let addr = native.vault_address(&v).unwrap();
        native.set_vault_balance(&addr, NonNegI64::try_from(40).unwrap());
        native.bond(&v, NonNegI64::try_from(40).unwrap(), 6).await.unwrap().unwrap();
        native.close_block(20).await.unwrap().unwrap();
        assert!(native.bonds().await.unwrap().contains_key(&v));
        assert!(!native.withdrawers().await.unwrap().contains_key(&v));
    }

    #[tokio::test]
    async fn fixed_slash_clears_pre_slash_committed_reward() {
        let native = fixture().await;
        let v = validator(1);
        earn_seven(&native, &v).await;
        native.slash(&v).await.unwrap().unwrap();
        assert!(!native.committed_rewards().await.unwrap().contains_key(&v));
    }

    #[tokio::test]
    async fn fixed_rebond_fresh_withdrawal_cannot_recover_pre_slash_reward() {
        let native = fixture().await;
        let v = validator(1);
        earn_seven(&native, &v).await;
        native.slash(&v).await.unwrap().unwrap();

        let addr = native.vault_address(&v).unwrap();
        native.set_vault_balance(&addr, NonNegI64::try_from(40).unwrap());
        native.bond(&v, NonNegI64::try_from(40).unwrap(), 11).await.unwrap().unwrap();
        native.withdraw(&v, 11).await.unwrap().unwrap();
        native.close_block(20).await.unwrap().unwrap();

        assert_eq!(i64::from(native.vault_balance(&addr).await.unwrap().unwrap()), 40);
        assert_eq!(i64::from(native.coop_balance().await.unwrap()), 40);
    }
}
