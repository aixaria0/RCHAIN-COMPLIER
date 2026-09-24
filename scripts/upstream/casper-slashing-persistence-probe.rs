// Injected inside upstream rholang/src/native_state.rs's existing #[cfg(test)] module.
// Isolated evidence probe: it does not modify production code or a live network.
#[tokio::test]
async fn aria_slash_removes_persisted_pending_withdrawal() {
    let v = validator(2);
    let native = native_with(&[v], PosParams::default(), &[(v, 40)]).await;
    native.set_pending_withdrawers(&BTreeMap::from([(v, 10)]));
    assert!(native.pending_withdrawers().await.unwrap().contains_key(&v));
    native.slash(&v).await.unwrap().unwrap();
    assert!(!native.bonds().await.unwrap().contains_key(&v));
    assert!(!native.active().await.unwrap().contains_key(&v));
    assert!(
        !native.pending_withdrawers().await.unwrap().contains_key(&v),
        "ARIA_SLASH_PENDING_LEAK: slash removes a pending request locally but fails to persist the removal"
    );
}

#[tokio::test]
async fn aria_slash_confiscates_committed_rewards_claim() {
    let v = validator(2);
    let native = native_with(&[v], PosParams::default(), &[(v, 40)]).await;
    native.set_committed_rewards(&BTreeMap::from([(v, NonNegI64::try_from(7).unwrap())]));
    assert_eq!(i64::from(native.committed_rewards().await.unwrap()[&v]), 7);
    native.slash(&v).await.unwrap().unwrap();
    assert_eq!(i64::from(native.coop_balance().await.unwrap()), 40);
    assert!(
        !native.committed_rewards().await.unwrap().contains_key(&v),
        "ARIA_SLASH_COMMITTED_LEAK: slash confiscates the bond but retains the validator's prior committed-rewards claim"
    );
}
