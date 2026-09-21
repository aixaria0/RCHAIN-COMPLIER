use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;
use std::time::Duration;

mod common;

use common::build_runtime_manager;
use rchain_block_storage::block_store::BlockStore;
use rchain_block_storage::dag::dag_storage::{BlockDagStorage, DeployId};
use rchain_block_storage::dag::finalizer::Message;
use rchain_block_storage::dag::message_state::DagMessageState;
use rchain_block_storage::dag::representation::DagRepresentation;
use rchain_casper::merging::BlockIndex;
use rchain_casper::multi_parent_casper::{get_pre_state_for_parents, validate};
use rchain_casper::interpreter_util::validate_block_checkpoint;
use rchain_rholang::native_state::PosGenesis;
use rchain_rholang::system_processes::BlockData;
use rchain_crypto::hash::blake2b512_random::Blake2b512Random;
use rchain_models::block_hash::BlockHash;
use rchain_models::block_metadata::BlockMetadata;
use rchain_models::block::state_hash::StateHash;
use rchain_models::casper::protocol::casper_message::{
    BlockMessage, RholangState, SignedDeployData,
};
use rchain_models::fringe_data::FringeData;
use rchain_models::validator::Validator;
use rchain_crypto::hash::blake2b256_hash::Blake2b256Hash;
use rchain_shared::refined::{BlockHeight, NonNegI64, SeqNum};
use rchain_shared::store::InMemoryKeyValueStore;
use rchain_shared::typed_store::KeyValueTypedStoreCodec;
use rchain_block_storage::dag::codecs::{BlockHashCodec, BlockMessageCodec};

fn hash(byte: u8) -> BlockHash {
    BlockHash::new([byte; 32])
}

fn validator(byte: u8) -> Validator {
    Validator::new([byte; 65])
}

fn message(
    id: BlockHash,
    sender: Validator,
    seq: i64,
    parents: &[BlockHash],
    seen: &[BlockHash],
) -> Message<BlockHash, Validator> {
    Message {
        id,
        height: BlockHeight::try_from(seq).unwrap(),
        sender,
        sender_seq: SeqNum::try_from(seq).unwrap(),
        bonds_map: BTreeMap::from([
            (validator(0), NonNegI64::try_from(70).unwrap()),
            (validator(1), NonNegI64::try_from(10).unwrap()),
            (validator(2), NonNegI64::try_from(10).unwrap()),
            (validator(3), NonNegI64::try_from(10).unwrap()),
        ]),
        parents: parents.iter().copied().collect(),
        fringe: BTreeSet::new(),
        seen: seen.iter().copied().collect(),
    }
}

fn metadata(
    id: BlockHash,
    sender: Validator,
    block_num: i64,
    seq: i64,
) -> BlockMetadata {
    BlockMetadata {
        block_hash: id,
        block_num: BlockHeight::try_from(block_num).unwrap(),
        sender,
        seq_num: SeqNum::try_from(seq).unwrap(),
        justifications: BTreeSet::new(),
        bonds_map: BTreeMap::from([
            (validator(0), NonNegI64::try_from(70).unwrap()),
            (validator(1), NonNegI64::try_from(10).unwrap()),
            (validator(2), NonNegI64::try_from(10).unwrap()),
            (validator(3), NonNegI64::try_from(10).unwrap()),
        ]),
        validated: true,
        validation_failed: false,
        fringe: BTreeSet::new(),
        fringe_state_hash: StateHash::new([0u8; 32]),
        member_of_fringe: None,
    }
}

fn block(id: BlockHash, sender: Validator, num: i64, seq: i64, state_hash: StateHash) -> BlockMessage {
    BlockMessage {
        version: 1,
        shard_id: "root".to_string(),
        block_hash: id,
        block_number: BlockHeight::try_from(num).unwrap(),
        sender,
        seq_num: SeqNum::try_from(seq).unwrap(),
        pre_state_hash: state_hash,
        post_state_hash: state_hash,
        justifications: Vec::new(),
        bonds: BTreeMap::new(),
        rejected_deploys: BTreeSet::new(),
        rejected_blocks: BTreeSet::new(),
        rejected_senders: BTreeSet::new(),
        state: RholangState::default(),
        sig_algorithm: "secp256k1".to_string(),
        sig: vec![1],
        timestamp: 0,
    }
}

struct MockDag {
    metadata: BTreeMap<BlockHash, BlockMetadata>,
    representation: DagRepresentation,
}

#[async_trait::async_trait]
impl BlockDagStorage for MockDag {
    async fn get_representation(&self) -> DagRepresentation {
        self.representation.clone()
    }
    async fn insert(&self, _m: BlockMetadata, _b: BlockMessage) -> Result<(), String> { Ok(()) }
    async fn lookup(&self, h: &BlockHash) -> Result<Option<BlockMetadata>, String> {
        Ok(self.metadata.get(h).cloned())
    }
    async fn lookup_by_deploy_id(&self, _d: &DeployId) -> Result<Option<BlockHash>, String> { Ok(None) }
    async fn add_deploy(&self, _d: SignedDeployData) -> Result<(), String> { Ok(()) }
    async fn pooled_deploys(&self) -> Result<BTreeMap<DeployId, SignedDeployData>, String> {
        Ok(BTreeMap::new())
    }
    async fn contains_deploy_in_pool(&self, _d: &DeployId) -> Result<bool, String> { Ok(false) }
}

async fn block_store(blocks: Vec<BlockMessage>) -> BlockStore {
    let store: BlockStore = Arc::new(KeyValueTypedStoreCodec::new(
        Arc::new(tokio::sync::Mutex::new(Box::new(
            InMemoryKeyValueStore::default(),
        ))),
        Arc::new(BlockHashCodec),
        Arc::new(BlockMessageCodec),
    ));
    let pairs = blocks.into_iter().map(|b| (b.block_hash, b)).collect::<Vec<_>>();
    store.put(&pairs).await.unwrap();
    store
}

#[tokio::test]
async fn m11_7_real_pre_state_path_advances_the_upstream_finalizer() {
    let v0 = validator(0);
    let v1 = validator(1);
    let v2 = validator(2);
    let v3 = validator(3);

    let g0 = hash(1);
    let g1 = hash(2);
    let g2 = hash(3);
    let g3 = hash(4);
    let a1 = hash(11);
    let b1 = hash(12);
    let c1 = hash(13);
    let d1 = hash(14);
    let a2 = hash(21);
    let b2 = hash(22);
    let c2 = hash(23);
    let d2 = hash(24);
    let a3 = hash(31);
    let b3 = hash(32);
    let c3 = hash(33);

    let l1 = [a1, b1, c1, d1];
    let l1_seen = [a1, b1, c1, d1, g0, g1, g2, g3];
    let l2 = [a2, b2, c2, d2];
    let l2_seen = [a2, b2, c2, d2, a1, b1, c1, d1, g0, g1, g2, g3];

    let mut messages = BTreeMap::new();
    for (id, sender) in [(g0, v0), (g1, v1), (g2, v2), (g3, v3)] {
        messages.insert(id, message(id, sender, 0, &[], &[id]));
    }
    for (id, sender, own) in [(a1, v0, g0), (b1, v1, g1), (c1, v2, g2), (d1, v3, g3)] {
        messages.insert(id, message(id, sender, 1, &[own], &[id, own]));
    }
    for (id, sender) in [(a2, v0), (b2, v1), (c2, v2), (d2, v3)] {
        messages.insert(id, message(id, sender, 2, &l1, &l1_seen.iter().chain([&id]).copied().collect::<Vec<_>>()));
    }
    for (id, sender) in [(a3, v0), (b3, v1), (c3, v2)] {
        messages.insert(id, message(id, sender, 3, &l2, &l2_seen.iter().chain([&id]).copied().collect::<Vec<_>>()));
    }

    let mut child_map: BTreeMap<BlockHash, BTreeSet<BlockHash>> = BTreeMap::new();
    for (id, msg) in &messages {
        child_map.entry(*id).or_default();
        for parent in &msg.parents {
            child_map.entry(*parent).or_default().insert(*id);
        }
    }

    let metadata_map = messages
        .iter()
        .map(|(id, msg)| {
            (*id, metadata(*id, msg.sender, i64::from(msg.height), i64::from(msg.sender_seq)))
        })
        .collect::<BTreeMap<_, _>>();

    let justifications: BTreeSet<BlockHash> = [a2, a3, b3, c3].into_iter().collect();
    let runtime = build_runtime_manager().await;
    let (_genesis_pre, genesis_post, _genesis_results) = runtime
        .compute_genesis(
            &[],
            &Blake2b512Random::default_random(),
            BlockData::empty(),
            &PosGenesis::default(),
            &[],
        )
        .await
        .expect("native PoS genesis state");
    let root = genesis_post;

    let blocks = messages
        .values()
        .map(|m| block(m.id, m.sender, i64::from(m.height), i64::from(m.sender_seq), root_state))
        .collect::<Vec<_>>();

    let empty_fringe = BTreeSet::new();
    let fringe_data = FringeData {
        fringe_hash: Blake2b256Hash::from_bytes([0u8; 32]),
        fringe: empty_fringe.clone(),
        fringe_diff: BTreeSet::new(),
        state_hash: root,
        rejected_deploys: BTreeSet::new(),
        rejected_blocks: BTreeSet::new(),
        rejected_senders: BTreeSet::new(),
    };

    let dag = MockDag {
        metadata: metadata_map,
        representation: DagRepresentation {
            dag_set: messages.keys().copied().collect(),
            child_map,
            height_map: BTreeMap::new(),
            dag_message_state: DagMessageState {
                latest_msgs: BTreeMap::new(),
                msg_map: messages,
            },
            fringe_states: BTreeMap::from([(empty_fringe, fringe_data)]),
        },
    };

    let store = block_store(blocks).await;

    let result = get_pre_state_for_parents(
        &dag,
        &store,
        &runtime,
        &justifications,
        &|_hash| async move {
            Ok(BlockIndex {
                block_hash: _hash,
                deploy_chains: Vec::new(),
            })
        },
    )
    .await
    .expect("real pre-state path should complete");

    let expected_fringe: BTreeSet<BlockHash> = [a1, b1, c1].into_iter().collect();
    assert_eq!(result.fringe, expected_fringe);
    assert_eq!(result.pre_state_hash, root);
    assert_eq!(result.fringe_state, root);
    assert_eq!(result.max_seq_nums.get(&v0), Some(&3));
    assert_eq!(result.max_seq_nums.get(&v1), Some(&3));
    assert_eq!(result.max_seq_nums.get(&v2), Some(&3));
    assert!(result.justifications.len() == 4);

    let mut candidate = block(hash(100), v0, 4, 4, root_state);
    candidate.justifications = vec![a2, a3, b3, c3];

    let (candidate_meta, validation) = validate_block_checkpoint(
        &runtime,
        &dag,
        &store,
        &candidate,
        &|block_hash| async move {
            Ok(BlockIndex {
                block_hash,
                deploy_chains: Vec::new(),
            })
        },
    )
    .await
    .expect("real validate_block_checkpoint path should complete");

    assert_eq!(validation, Ok(true));
    assert!(!candidate_meta.validation_failed);
    assert_eq!(candidate_meta.fringe, expected_fringe);
    assert_eq!(candidate_meta.fringe_state_hash, StateHash::new(*root.as_bytes()));

    let validated_meta = tokio::time::timeout(
        Duration::from_secs(30),
        validate(
        &dag,
        &store,
        &runtime,
        &candidate,
        "root",
        0,
        &|block_hash| async move {
            Ok(BlockIndex {
                block_hash,
                deploy_chains: Vec::new(),
            })
        },
        ),
    )
    .await
    .expect("full MultiParentCasper::validate path exceeded 30s")
    .expect("full MultiParentCasper::validate path should complete");

    assert_eq!(validated_meta.block_hash, candidate.block_hash);
    assert!(!validated_meta.validation_failed);
}
