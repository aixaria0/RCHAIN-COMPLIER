use std::collections::{BTreeMap, BTreeSet};

use async_trait::async_trait;
use rchain_block_storage::block_store::BlockStore;
use rchain_block_storage::dag::codecs::{BlockHashCodec, BlockMessageCodec};
use rchain_block_storage::dag::dag_storage::{BlockDagStorage, DeployId};
use rchain_block_storage::dag::message_state::DagMessageState;
use rchain_block_storage::dag::representation::DagRepresentation;
use rchain_models::block_hash::BlockHash;
use rchain_models::block_metadata::BlockMetadata;
use rchain_models::casper::protocol::casper_message::{
    BlockMessage, RholangState, SignedDeployData,
};
use rchain_models::validator::Validator;
use rchain_shared::refined::{BlockHeight, SeqNum};
use rchain_shared::store::InMemoryKeyValueStore;
use rchain_shared::typed_store::KeyValueTypedStoreCodec;
use rchain_casper::validate::block_summary;
use std::sync::Arc;

fn hash(byte: u8) -> BlockHash {
    BlockHash::new([byte; 32])
}

fn validator(byte: u8) -> Validator {
    Validator::new([byte; 65])
}

fn metadata(hash: BlockHash, block_num: i64, sender: Validator, seq: i64) -> BlockMetadata {
    BlockMetadata {
        block_hash: hash,
        block_num: BlockHeight::try_from(block_num).unwrap(),
        sender,
        seq_num: SeqNum::try_from(seq).unwrap(),
        justifications: BTreeSet::new(),
        bonds_map: BTreeMap::new(),
        validated: true,
        validation_failed: false,
        fringe: BTreeSet::new(),
        fringe_state_hash: rchain_models::block::state_hash::StateHash::new([0u8; 32]),
        member_of_fringe: None,
    }
}

struct MockDag {
    metadata: BTreeMap<BlockHash, BlockMetadata>,
    representation: DagRepresentation,
}

#[async_trait]
impl BlockDagStorage for MockDag {
    async fn get_representation(&self) -> DagRepresentation {
        self.representation.clone()
    }

    async fn insert(&self, _m: BlockMetadata, _b: BlockMessage) -> Result<(), String> {
        Ok(())
    }

    async fn lookup(&self, h: &BlockHash) -> Result<Option<BlockMetadata>, String> {
        Ok(self.metadata.get(h).cloned())
    }

    async fn lookup_by_deploy_id(&self, _d: &DeployId) -> Result<Option<BlockHash>, String> {
        Ok(None)
    }

    async fn add_deploy(&self, _d: SignedDeployData) -> Result<(), String> {
        Ok(())
    }

    async fn pooled_deploys(&self) -> Result<BTreeMap<DeployId, SignedDeployData>, String> {
        Ok(BTreeMap::new())
    }

    async fn contains_deploy_in_pool(&self, _d: &DeployId) -> Result<bool, String> {
        Ok(false)
    }
}

fn block(
    id: BlockHash,
    sender: Validator,
    block_num: i64,
    seq: i64,
    justifications: Vec<BlockHash>,
) -> BlockMessage {
    BlockMessage {
        version: 1,
        shard_id: "root".to_string(),
        block_hash: id,
        block_number: BlockHeight::try_from(block_num).unwrap(),
        sender,
        seq_num: SeqNum::try_from(seq).unwrap(),
        pre_state_hash: rchain_models::block::state_hash::StateHash::new([1u8; 32]),
        post_state_hash: rchain_models::block::state_hash::StateHash::new([2u8; 32]),
        justifications,
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

async fn block_store(blocks: Vec<BlockMessage>) -> BlockStore {
    let store: BlockStore = Arc::new(KeyValueTypedStoreCodec::new(
        Arc::new(tokio::sync::Mutex::new(Box::new(
            InMemoryKeyValueStore::default(),
        ))),
        Arc::new(BlockHashCodec),
        Arc::new(BlockMessageCodec),
    ));
    let pairs: Vec<(BlockHash, BlockMessage)> =
        blocks.into_iter().map(|b| (b.block_hash, b)).collect();
    store.put(&pairs).await.unwrap();
    store
}

fn dag_with_messages(
    entries: &[(BlockHash, Validator, i64, i64)],
) -> MockDag {
    let msg_map = entries
        .iter()
        .map(|(id, sender, _block_num, seq)| {
            (
                *id,
                rchain_block_storage::dag::finalizer::Message {
                    id: *id,
                    height: BlockHeight::zero(),
                    sender: *sender,
                    sender_seq: SeqNum::try_from(*seq).unwrap(),
                    bonds_map: BTreeMap::new(),
                    parents: BTreeSet::new(),
                    fringe: BTreeSet::new(),
                    seen: BTreeSet::from([*id]),
                },
            )
        })
        .collect();

    MockDag {
        metadata: entries
            .iter()
            .map(|(id, sender, block_num, seq)| {
                (*id, metadata(*id, *block_num, *sender, *seq))
            })
            .collect(),
        representation: DagRepresentation {
            dag_set: entries.iter().map(|(id, _, _, _)| *id).collect(),
            child_map: BTreeMap::new(),
            height_map: BTreeMap::new(),
            dag_message_state: DagMessageState {
                latest_msgs: BTreeMap::new(),
                msg_map,
            },
            fringe_states: BTreeMap::new(),
        },
    }
}

#[tokio::test]
async fn m11_6_active_block_summary_admits_duplicate_sender_justifications() {
    let v0 = validator(0);
    let v1 = validator(1);
    let v2 = validator(2);
    let v3 = validator(3);

    // Five distinct justification hashes, but only four distinct senders:
    // v0 appears twice. The current validator is v3 and its own latest
    // justification is included so sequence-number validation remains realistic.
    let j0 = hash(10); // v0
    let j1 = hash(11); // v0 again
    let j2 = hash(12); // v1
    let j3 = hash(13); // v2
    let j4 = hash(14); // v3

    let entries = [
        (j0, v0, 10, 1),
        (j1, v0, 10, 2),
        (j2, v1, 10, 1),
        (j3, v2, 10, 1),
        (j4, v3, 10, 1),
    ];
    let dag = dag_with_messages(&entries);

    let parents = entries
        .iter()
        .map(|(id, sender, block_num, seq)| block(*id, *sender, *block_num, *seq, vec![]))
        .collect::<Vec<_>>();

    let current = block(
        hash(20),
        v3,
        11,
        2,
        vec![j0, j1, j2, j3, j4],
    );
    let store = block_store(parents).await;

    let result = block_summary(&dag, &store, &current, "root", 50, 0)
        .await
        .expect("active block-summary path must execute");

    assert_eq!(
        result,
        Ok(()),
        "the active validation path should not reject duplicate-sender justifications"
    );
}

#[test]
fn m11_6_sender_set_helper_does_not_detect_duplicate_senders() {
    use rchain_sdk::casper_syntax::invalid_justification_follows;
    use rchain_sdk::dag::data::{DagData, DagView};
    use rchain_shared::refined::NonNegI64;

    #[derive(Clone)]
    struct Msg {
        sender: i32,
    }

    struct Data;
    impl DagData<Msg, i32, i32, i32> for Data {
        fn mid(&self, _m: &Msg) -> i32 { 0 }
        fn seq_num(&self, _m: &Msg) -> i64 { 0 }
        fn block_num(&self, _m: &Msg) -> i64 { 0 }
        fn justifications(&self, _m: &Msg) -> Vec<i32> { vec![1, 2, 3, 4, 5] }
        fn sender(&self, m: &Msg) -> i32 { m.sender }
        fn bonds_map(&self, _m: &Msg) -> Vec<(i32, NonNegI64)> { vec![] }
        fn sid(&self, s: &i32) -> i32 { *s }
    }

    struct View;
    impl DagView<Msg, i32, i32, i32> for View {
        fn seen_by(&self) -> Msg { unreachable!() }
        fn messages(&self) -> Vec<(Msg, Vec<Msg>)> { vec![] }
        fn load_message(&self, mid: &i32) -> Msg {
            Msg { sender: match *mid {
                1 | 2 => 0,
                3 => 1,
                4 => 2,
                5 => 3,
                _ => panic!("unexpected message id"),
            }}
        }
        fn load_sender(&self, s: &i32) -> i32 { *s }
    }

    let msg = Msg { sender: 3 };
    let bonded: BTreeSet<i32> = [0, 1, 2, 3].into_iter().collect();

    assert!(
        !invalid_justification_follows(&View, &Data, &msg, &bonded),
        "the helper sees the sender set [v0, v1, v2, v3] after deduplication and therefore does not flag the duplicate"
    );
}
