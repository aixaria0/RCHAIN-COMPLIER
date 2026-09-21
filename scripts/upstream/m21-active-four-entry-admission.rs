// M21A — exact four-entry duplicate-sender witness through active block_summary.
//
// Unlike the earlier five-entry M11.6 witness, this fixture uses exactly four
// justification entries for four bonded validators' cardinality, but v0 occurs
// twice and v3 is absent. The proposer is v0, so the active sequence-number
// check still has a self-justification and can pass.

#[cfg(test)]
mod m21_active_four_entry_admission {
    use super::*;
    use std::collections::{BTreeMap, BTreeSet};
    use std::sync::Arc;

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

    fn hash(byte: u8) -> BlockHash { BlockHash::new([byte; 32]) }
    fn validator(byte: u8) -> Validator { Validator::new([byte; 65]) }

    fn metadata(id: BlockHash, sender: Validator, seq: i64) -> BlockMetadata {
        BlockMetadata {
            block_hash: id,
            block_num: BlockHeight::try_from(10).unwrap(),
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
        async fn get_representation(&self) -> DagRepresentation { self.representation.clone() }
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

    fn block(id: BlockHash, sender: Validator, block_num: i64, seq: i64) -> BlockMessage {
        BlockMessage {
            version: 1,
            shard_id: "root".to_string(),
            block_hash: id,
            block_number: BlockHeight::try_from(block_num).unwrap(),
            sender,
            seq_num: SeqNum::try_from(seq).unwrap(),
            pre_state_hash: rchain_models::block::state_hash::StateHash::new([1u8; 32]),
            post_state_hash: rchain_models::block::state_hash::StateHash::new([2u8; 32]),
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

    async fn store(blocks: Vec<BlockMessage>) -> BlockStore {
        let store: BlockStore = Arc::new(KeyValueTypedStoreCodec::new(
            Arc::new(tokio::sync::Mutex::new(Box::new(InMemoryKeyValueStore::default()))),
            Arc::new(BlockHashCodec),
            Arc::new(BlockMessageCodec),
        ));
        let pairs = blocks.into_iter().map(|b| (b.block_hash, b)).collect::<Vec<_>>();
        store.put(&pairs).await.unwrap();
        store
    }

    fn dag(entries: &[(BlockHash, Validator, i64)]) -> MockDag {
        let msg_map = entries.iter().map(|(id, sender, seq)| {
            (*id, rchain_block_storage::dag::finalizer::Message {
                id: *id,
                height: BlockHeight::try_from(10).unwrap(),
                sender: *sender,
                sender_seq: SeqNum::try_from(*seq).unwrap(),
                bonds_map: BTreeMap::new(),
                parents: BTreeSet::new(),
                fringe: BTreeSet::new(),
                seen: BTreeSet::from([*id]),
            })
        }).collect();

        MockDag {
            metadata: entries.iter().map(|(id, sender, seq)| (*id, metadata(*id, *sender, *seq))).collect(),
            representation: DagRepresentation {
                dag_set: entries.iter().map(|(id, _, _)| *id).collect(),
                child_map: BTreeMap::new(),
                height_map: BTreeMap::new(),
                dag_message_state: DagMessageState { latest_msgs: BTreeMap::new(), msg_map },
                fringe_states: BTreeMap::new(),
            },
        }
    }

    #[tokio::test]
    async fn exact_four_entry_duplicate_sender_shape_is_admitted() {
        let v0 = validator(0);
        let v1 = validator(1);
        let v2 = validator(2);

        let j0 = hash(10); // v0 seq 1
        let j1 = hash(11); // v0 seq 2 (duplicate sender)
        let j2 = hash(12); // v1 seq 1
        let j3 = hash(13); // v2 seq 1; v3 is absent

        let entries = [
            (j0, v0, 1),
            (j1, v0, 2),
            (j2, v1, 1),
            (j3, v2, 1),
        ];
        let dag = dag(&entries);
        let parents = entries.iter().map(|(id, sender, seq)| block(*id, *sender, 10, *seq)).collect();
        let mut current = block(hash(20), v0, 11, 3);
        current.justifications = vec![j0, j1, j2, j3];
        let result = block_summary(&dag, &store(parents).await, &current, "root", 50, 0)
            .await
            .expect("active summary must execute");

        assert_eq!(current.justifications.len(), 4);
        assert_eq!(entries.iter().map(|(_, s, _)| *s).collect::<BTreeSet<_>>(),
            [v0, v1, v2].into_iter().collect());
        assert_eq!(result, Ok(()));
    }
}
