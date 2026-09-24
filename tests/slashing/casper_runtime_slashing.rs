//! Real Rholang execution, Casper system-deploy play and validation replay.
//! This exercises the runtime manager, not signed HTTP ingress or live peer consensus.
mod common;

use rchain_casper::genesis::contracts::Vault;
use rchain_casper::system_deploy::SystemDeploy;
use rchain_crypto::hash::blake2b512_random::Blake2b512Random;
use rchain_crypto::public_key::PublicKey;
use rchain_models::casper::protocol::casper_message::{
    DeployData, ProcessedDeploy, ProcessedSystemDeploy, SignedDeployData,
};
use rchain_models::validator::Validator;
use rchain_rholang::native_state::{NativeSystemState, PosGenesis, PosParams};
use rchain_rholang::system_processes::BlockData;
use rchain_rholang::util::rev_address::RevAddress;
use rchain_shared::refined::{BlockHeight, NonNegI64};

fn signed_for_runtime(term: &str, height: i64) -> SignedDeployData {
    SignedDeployData {
        data: DeployData {
            attachments: Vec::new(),
            term: term.to_string(),
            timestamp: height,
            phlo_price: 1,
            phlo_limit: 500_000,
            valid_after_block_number: 0,
            shard_id: "root".to_string(),
        },
        deployer: vec![0; 65],
        sig: Vec::new(),
        sig_algorithm: "secp256k1".to_string(),
    }
}

fn block(height: i64) -> BlockData {
    BlockData {
        block_number: BlockHeight::try_from(height).unwrap(),
        ..BlockData::empty()
    }
}

#[tokio::test]
async fn actual_runtime_withdraw_slash_rebond_close_and_replay() {
    let rm = common::build_runtime_manager().await;
    let random = Blake2b512Random::from_init(&[0; 32]);
    let validator = Validator::new([0; 65]);
    let address = RevAddress::from_public_key(&PublicKey::new(vec![0; 65])).unwrap();
    let genesis = PosGenesis {
        bonds: [(validator, NonNegI64::try_from(40).unwrap())].into_iter().collect(),
        trusted: [validator].into_iter().collect(),
        params: PosParams {
            minimum_bond: 1,
            epoch_length: 10,
            quarantine_length: 20,
            ..Default::default()
        },
    };
    let (_, mut state, _) = rm
        .compute_genesis(
            &[], &random, BlockData::empty(), &genesis,
            &[Vault { rev_address: address.clone(), initial_balance: NonNegI64::try_from(1_000_000_000).unwrap() }],
        )
        .await.unwrap();
    let withdraw = r#"new pos(`rho:rchain:pos`), deployerId(`rho:rchain:deployerId`), ret in {
  pos!("withdraw", *deployerId, *ret) | for (_ <- ret) { Nil }
}"#;
    let bond = r#"new pos(`rho:rchain:pos`), deployerId(`rho:rchain:deployerId`), ret in {
  pos!("bond", *deployerId, 30, *ret) | for (_ <- ret) { Nil }
}"#;

    for (height, user, slash) in [
        (5, Some(withdraw), false),
        (6, None, true),
        (7, Some(bond), false),
        (10, None, false),
    ] {
        let deploys: Vec<_> = user.into_iter().map(|term| signed_for_runtime(term, height)).collect();
        let mut systems = Vec::new();
        if slash { systems.push(SystemDeploy::slash(&validator, random.split_byte(1))); }
        systems.push(SystemDeploy::close_block(height, random.split_byte(2)));
        let data = block(height);
        let (played, users, sys) = rm.compute_state(&state, &deploys, &systems, &random, data.clone())
            .await.expect("actual Casper play");
        for result in &users {
            assert!(result.eval_result.succeeded(), "Rholang execution at {height}: {:?}", result.eval_result.errors);
            assert!(!result.deploy.is_failed, "user deploy failed at {height}");
        }
        assert_eq!(sys.len(), systems.len(), "system deploy at {height}");
        let processed: Vec<ProcessedDeploy> = users.into_iter().map(|r| r.deploy).collect();
        let processed_sys: Vec<ProcessedSystemDeploy> = sys.into_iter().map(|r| r.deploy).collect();
        let (replayed, _) = rm.replay_compute_state(
            &state, &processed, &processed_sys, &random, data, true, &genesis, &[],
        ).await.expect("actual Casper validation replay");
        assert_eq!(played, replayed, "state hash disagrees at block {height}");
        state = replayed;
        let fork = rm.fork_play_runtime(state).await.expect("post-state fork");
        fork.reset(state).await.expect("load committed state");
        let pos = NativeSystemState::new(fork.native_store());
        let pending = pos.pending_withdrawers().await.unwrap().contains_key(&validator);
        let bonded = pos.bonds().await.unwrap().contains_key(&validator);
        let claim = pos.withdrawers().await.unwrap().get(&validator).map(|w| i64::from(w.bond)).unwrap_or(0);
        println!("ARIA_CASPER_REAL_V1|height={height}|pending={pending}|bonded={bonded}|claim={claim}|play_replay_equal=true");
        match height {
            5 => { assert!(pending); assert!(bonded); }
            6 => { assert!(pending); assert!(!bonded); }
            7 => { assert!(pending); assert!(bonded); }
            10 => { assert!(!pending); assert!(!bonded); assert_eq!(claim, 30); }
            _ => unreachable!(),
        }
    }
}
