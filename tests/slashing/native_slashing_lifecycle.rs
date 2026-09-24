//! Research integration tests against the pinned, actual native PoS implementation.
//! No signed ingress, proposer, or live-network execution is claimed.
use std::collections::BTreeMap;
use std::sync::Arc;
use rchain_crypto::public_key::PublicKey;
use rchain_models::validator::Validator;
use rchain_rholang::native_state::{NativeSystemState, PosGenesis, PosParams};
use rchain_rholang::util::rev_address::RevAddress;
use rchain_rspace::native_store::InMemNativeStore;
use rchain_shared::refined::NonNegI64;

fn v(n: u8) -> Validator {
    let mut bytes = [n; 65];
    bytes[0] = 0x04;
    Validator::from_slice(&bytes)
}
fn nn(n: i64) -> NonNegI64 { NonNegI64::try_from(n).unwrap() }
fn address(who: &Validator) -> String {
    RevAddress::from_public_key(&PublicKey::new(who.as_bytes().to_vec())).unwrap().to_base58()
}
fn state(stake: i64) -> NativeSystemState {
    let s = NativeSystemState::new(Arc::new(InMemNativeStore::empty()));
    s.install_genesis(&PosGenesis {
        bonds: BTreeMap::from([(v(1), nn(stake)), (v(2), nn(10))]),
        trusted: [v(1), v(2)].into_iter().collect(),
        params: PosParams { epoch_length: 10, quarantine_length: 20, ..PosParams::default() },
    }).unwrap();
    s.set_vault_balance(&address(&v(1)), nn(100));
    s
}
async fn total(s: &NativeSystemState) -> i64 {
    i64::from(s.pos_vault_balance().await.unwrap())
        + i64::from(s.coop_balance().await.unwrap())
        + i64::from(s.vault_balance(&address(&v(1))).await.unwrap().unwrap())
}

#[tokio::test]
async fn control_slash_conserves_value_and_repeat_does_not_charge_again() {
    let s = state(40);
    let before = total(&s).await;
    s.slash(&v(1)).await.unwrap().unwrap();
    assert!(!s.bonds().await.unwrap().contains_key(&v(1)));
    assert!(!s.active().await.unwrap().contains_key(&v(1)));
    assert_eq!(i64::from(s.coop_balance().await.unwrap()), 40);
    assert_eq!(i64::from(s.pos_vault_balance().await.unwrap()), 10);
    s.slash(&v(1)).await.unwrap().unwrap();
    assert_eq!(total(&s).await, before);
    assert_eq!(i64::from(s.coop_balance().await.unwrap()), 40);
}

#[tokio::test]
async fn control_unslashed_withdrawal_obeys_epoch_and_deadline() {
    let s = state(40);
    let before = total(&s).await;
    s.withdraw(&v(1), 5).await.unwrap().unwrap();
    assert_eq!(s.pending_withdrawers().await.unwrap()[&v(1)], 30);
    s.close_block(9).await.unwrap().unwrap();
    assert!(s.bonds().await.unwrap().contains_key(&v(1)));
    s.close_block(10).await.unwrap().unwrap();
    assert!(!s.bonds().await.unwrap().contains_key(&v(1)));
    assert_eq!(i64::from(s.withdrawers().await.unwrap()[&v(1)].bond), 40);
    s.close_block(20).await.unwrap().unwrap();
    assert_eq!(i64::from(s.vault_balance(&address(&v(1))).await.unwrap().unwrap()), 100);
    s.close_block(30).await.unwrap().unwrap();
    assert_eq!(i64::from(s.vault_balance(&address(&v(1))).await.unwrap().unwrap()), 140);
    assert!(s.withdrawers().await.unwrap().is_empty());
    assert_eq!(total(&s).await, before);
}

#[tokio::test]
async fn control_no_rebond_clears_stale_request_without_payout() {
    let s = state(40);
    let before = total(&s).await;
    s.withdraw(&v(1), 5).await.unwrap().unwrap();
    s.slash(&v(1)).await.unwrap().unwrap();
    s.close_block(10).await.unwrap().unwrap();
    assert!(!s.pending_withdrawers().await.unwrap().contains_key(&v(1)));
    assert!(!s.withdrawers().await.unwrap().contains_key(&v(1)));
    s.close_block(30).await.unwrap().unwrap();
    assert_eq!(i64::from(s.vault_balance(&address(&v(1))).await.unwrap().unwrap()), 100);
    assert_eq!(total(&s).await, before);
}

#[tokio::test]
async fn contract_slash_cancels_pending_withdrawal_grid() {
    let mut stale = 0;
    for stake in [1, 40, 100] {
        for request_height in [1, 5, 9] {
            let s = state(stake);
            let before = total(&s).await;
            s.withdraw(&v(1), request_height).await.unwrap().unwrap();
            s.slash(&v(1)).await.unwrap().unwrap();
            stale += usize::from(s.pending_withdrawers().await.unwrap().contains_key(&v(1)));
            assert_eq!(total(&s).await, before);
        }
    }
    println!("ARIA_SLASH_V1|case=pending_grid|cases=9|stale={stale}");
    assert_eq!(stale, 0, "documented cancellation must be persisted immediately");
}

#[tokio::test]
async fn contract_new_bond_does_not_inherit_cancelled_withdrawal() {
    let s = state(40);
    let before = total(&s).await;
    s.withdraw(&v(1), 5).await.unwrap().unwrap();
    s.slash(&v(1)).await.unwrap().unwrap();
    // The native slash operation keeps trust. Use the public bond API with fresh funds.
    assert!(s.trusted().await.unwrap().contains(&v(1)));
    s.bond(&v(1), nn(30), 6).await.unwrap().unwrap();
    s.close_block(10).await.unwrap().unwrap();
    let bonded = s.bonds().await.unwrap().contains_key(&v(1));
    let claim = s.withdrawers().await.unwrap().get(&v(1)).map(|w| i64::from(w.bond)).unwrap_or(0);
    s.close_block(30).await.unwrap().unwrap();
    let wallet = i64::from(s.vault_balance(&address(&v(1))).await.unwrap().unwrap());
    assert_eq!(total(&s).await, before);
    assert_eq!(i64::from(s.coop_balance().await.unwrap()), 40);
    println!("ARIA_SLASH_V1|case=rebond|bonded_at_boundary={bonded}|claim={claim}|wallet_at_30={wallet}");
    assert!(bonded, "the new bond must not inherit the old withdrawal request");
    assert_eq!(claim, 0);
    assert_eq!(wallet, 70);
}
