//! Conditional cancellation-policy regression, run only with the persistence candidate.
//! Direct state fixture: no wire ingress, rebond sequence, or consensus evidence generation.
mod common;

use rchain_crypto::hash::blake2b512_random::Blake2b512Random;
use rchain_models::validator::Validator;
use rchain_rholang::native_state::{NativeSystemState, PosGenesis};
use rchain_rholang::system_processes::BlockData;
use rchain_shared::refined::NonNegI64;

#[tokio::test]
async fn cancellation_survives_checkpoint_restore_and_preserves_other_validator() {
    let rm = common::build_runtime_manager().await;
    let target = Validator::new([1; 65]);
    let other = Validator::new([2; 65]);
    let genesis = PosGenesis {
        bonds: [(target, NonNegI64::try_from(40).unwrap()),
                (other, NonNegI64::try_from(60).unwrap())].into_iter().collect(),
        trusted: [target, other].into_iter().collect(),
        ..PosGenesis::default()
    };
    let random = Blake2b512Random::from_init(&[0; 32]);
    let (_, genesis_root, _) = rm.compute_genesis(
        &[], &random, BlockData::empty(), &genesis, &[]
    ).await.expect("genesis");
    let setup = rm.fork_play_runtime(genesis_root).await.expect("setup runtime");
    setup.reset(genesis_root).await.expect("setup reset");
    let pending = [(target, 30), (other, 40)].into_iter().collect();
    NativeSystemState::new(setup.native_store()).set_pending_withdrawers(&pending);
    let before = setup.create_checkpoint().await.expect("fixture checkpoint").root;
    let mut roots = Vec::new();

    // Two fresh runtimes apply the same repaired transition to the same committed fixture.
    for _ in 0..2 {
        let runtime = rm.fork_play_runtime(before).await.expect("transition runtime");
        runtime.reset(before).await.expect("restore input");
        let native = NativeSystemState::new(runtime.native_store());
        native.slash(&target).await.expect("storage").expect("transition");
        let after = runtime.create_checkpoint().await.expect("commit").root;
        assert_ne!(before, after);

        let restored = rm.fork_play_runtime(after).await.expect("fresh reader");
        restored.reset(after).await.expect("restore output");
        let read = NativeSystemState::new(restored.native_store());
        assert_eq!(read.pending_withdrawers().await.unwrap(), [(other, 40)].into_iter().collect());
        assert_eq!(read.bonds().await.unwrap(), [(other, NonNegI64::try_from(60).unwrap())].into_iter().collect());
        assert!(!read.active().await.unwrap().contains_key(&target));
        assert_eq!(i64::from(read.pos_vault_balance().await.unwrap()), 60);
        assert_eq!(i64::from(read.coop_balance().await.unwrap()), 40);

        // Applying removal again must not transfer value again or change the root.
        read.slash(&target).await.unwrap().unwrap();
        assert_eq!(restored.create_checkpoint().await.unwrap().root, after);
        roots.push(after);
    }
    assert_eq!(roots[0], roots[1], "same input and repaired transition have identical roots");
    let old = rm.fork_play_runtime(before).await.expect("old snapshot");
    old.reset(before).await.expect("old root restore");
    assert_eq!(NativeSystemState::new(old.native_store()).pending_withdrawers().await.unwrap(), pending);
}
