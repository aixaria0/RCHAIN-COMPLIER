// M25 — active-path counterfactual gate.
//
// The exact active block_summary path is left unchanged. This probe computes
// the smallest sender-coverage discriminator over the real DAG justifications
// and compares:
//   (a) current upstream block_summary result
//   (b) counterfactual sender-set gate result
//
// It is an impact/remediation characterization, not an upstream patch.

#[cfg(test)]
mod m25_active_gate_counterfactual {
    use super::*;
    use std::collections::{BTreeMap, BTreeSet};
    use std::sync::Arc;

    use async_trait::async_trait;
    use rchain_block_storage::block_store::BlockStore;
    use rchain_block_storage::dag::codecs::{BlockHashCodec, BlockMessageCodec};
    use rchain_block_storage::dag::dag_storage::{BlockDagStorage, DeployId};
    use rchain_block_storage::dag::finalizer::Message;
    use rchain_block_storage::dag::message_state::DagMessageState;
    use rchain_block_storage::dag::representation::DagRepresentation;
    use rchain_models::block::state_hash::StateHash;
    use rchain_models::block_hash::BlockHash;
    use rchain_models::block_metadata::BlockMetadata;
    use rchain_models::casper::protocol::casper_message::{BlockMessage, RholangState, SignedDeployData};
    use rchain_models::validator::Validator;
    use rchain_shared::refined::{BlockHeight, NonNegI64, SeqNum};
    use rchain_shared::store::InMemoryKeyValueStore;
    use rchain_shared::typed_store::KeyValueTypedStoreCodec;

    struct MockDag {
        representation: DagRepresentation,
        metadata: BTreeMap<BlockHash, BlockMetadata>,
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

    fn hash(byte: u8) -> BlockHash {
        BlockHash::new([byte; 32])
    }

    fn validator(byte: u8) -> Validator {
        Validator::new([byte; 65])
    }

    fn bonds() -> BTreeMap<Validator, NonNegI64> {
        BTreeMap::from([
            (validator(0), NonNegI64::try_from(25).unwrap()),
            (validator(1), NonNegI64::try_from(25).unwrap()),
            (validator(2), NonNegI64::try_from(25).unwrap()),
            (validator(3), NonNegI64::try_from(25).unwrap()),
        ])
    }

    fn parent_message(id: BlockHash, sender: Validator) -> Message<BlockHash, Validator> {
        Message {
            id,
            height: BlockHeight::try_from(10).unwrap(),
            sender,
            sender_seq: SeqNum::try_from(1).unwrap(),
            bonds_map: bonds(),
            parents: BTreeSet::new(),
            fringe: BTreeSet::new(),
            seen: BTreeSet::from([id]),
        }
    }

    fn metadata(id: BlockHash, sender: Validator, seq: i64) -> BlockMetadata {
        BlockMetadata {
            block_hash: id,
            block_num: BlockHeight::try_from(10).unwrap(),
            sender,
            seq_num: SeqNum::try_from(seq).unwrap(),
            justifications: BTreeSet::new(),
            bonds_map: bonds(),
            validated: true,
            validation_failed: false,
            fringe: BTreeSet::new(),
            fringe_state_hash: StateHash::new([0u8; 32]),
            member_of_fringe: None,
        }
    }

    fn block(
        id: BlockHash,
        sender: Validator,
        seq: i64,
        justifications: Vec<BlockHash>,
    ) -> BlockMessage {
        BlockMessage {
            version: 1,
            shard_id: "root".to_string(),
            block_hash: id,
            block_number: BlockHeight::try_from(11).unwrap(),
            sender,
            seq_num: SeqNum::try_from(seq).unwrap(),
            pre_state_hash: StateHash::new([1u8; 32]),
            post_state_hash: StateHash::new([2u8; 32]),
            justifications,
            bonds: bonds(),
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
        let pairs = blocks.into_iter().map(|b| (b.block_hash, b)).collect::<Vec<_>>();
        store.put(&pairs).await.unwrap();
        store
    }

    async fn sender_coverage_ok(
        dag: &dyn BlockDagStorage,
        block: &BlockMessage,
    ) -> Result<bool, String> {
        let bonded: BTreeSet<Validator> = block
            .bonds
            .iter()
            .filter(|(_, stake)| i64::from(**stake) > 0)
            .map(|(sender, _)| *sender)
            .collect();

        let mut senders = BTreeSet::new();
        for j in &block.justifications {
            let meta = dag
                .lookup(j)
                .await?
                .ok_or_else(|| format!("missing justification {}", j.to_hex()))?;
            senders.insert(meta.sender);
        }

        Ok(senders == bonded)
    }

    #[tokio::test]
    async fn m25_active_gate_counterfactual() {
        let v0 = validator(0);
        let v1 = validator(1);
        let v2 = validator(2);
        let v3 = validator(3);
        let vx = validator(9);

        let j0 = hash(10);
        let j1 = hash(11);
        let j2 = hash(12);
        let j3 = hash(13);
        let jx = hash(19);

        let entries = [
            (j0, v0, 1),
            (j1, v0, 2),
            (j2, v1, 1),
            (j3, v2, 1),
            (jx, vx, 1),
        ];

        let msg_map = entries
            .iter()
            .map(|(id, sender, seq)| (*id, parent_message(*id, *sender)))
            .collect::<BTreeMap<_, _>>();

        let metadata_map = entries
            .iter()
            .map(|(id, sender, seq)| (*id, metadata(*id, *sender, *seq)))
            .collect::<BTreeMap<_, _>>();

        let dag = MockDag {
            representation: DagRepresentation {
                dag_set: msg_map.keys().copied().collect(),
                child_map: BTreeMap::new(),
                height_map: BTreeMap::new(),
                dag_message_state: DagMessageState {
                    latest_msgs: BTreeMap::new(),
                    msg_map,
                },
                fringe_states: BTreeMap::new(),
            },
            metadata: metadata_map,
        };

        let store = block_store(parent_blocks).await;

        let j4 = hash(14);

        let j4_message = parent_message(j4, v3);
        let j4_meta = metadata(j4, v3, 1);

        let mut dag = dag;
        dag.representation.dag_message_state.msg_map.insert(j4, j4_message);
        dag.representation.dag_set.insert(j4);
        dag.metadata.insert(j4, j4_meta);

        let parent_blocks = vec![
            block(j0, v0, 1, vec![]),
            block(j1, v0, 2, vec![]),
            block(j2, v1, 1, vec![]),
            block(j3, v2, 1, vec![]),
            block(j4, v3, 1, vec![]),
            block(jx, vx, 1, vec![]),
        ];

        let duplicate_missing = block(
            hash(20),
            v0,
            3,
            vec![j0, j1, j2, j3],
        );

        let valid_control = block(
            hash(21),
            v0,
            3,
            vec![j0, j2, j3, j4],
        );

        let nonbonded_replacement = block(
            hash(22),
            v0,
            3,
            vec![j0, j2, j3, jx],
        );

        let current_duplicate = block_summary(&dag, &store, &duplicate_missing, "root", 50, 0)
            .await
            .expect("current active path must execute");
        let current_valid = block_summary(&dag, &store, &valid_control, "root", 50, 0)
            .await
            .expect("current control path must execute");
        let current_nonbonded = block_summary(&dag, &store, &nonbonded_replacement, "root", 50, 0)
            .await
            .expect("current non-bonded path must execute");

        assert_eq!(current_duplicate, Ok(()));
        assert_eq!(current_valid, Ok(()));
        assert_eq!(current_nonbonded, Ok(()));

        // Counterfactual gate: exact sender-set equality at admission.
        // The duplicate witness misses v3 and therefore fails.
        assert!(
            !sender_coverage_ok(&dag, &duplicate_missing).await.unwrap(),
            "duplicate witness must fail distinct bonded-sender coverage"
        );

        // Control contains one justification from every bonded sender.
        assert!(
            sender_coverage_ok(&dag, &valid_control).await.unwrap(),
            "one-message-per-bonded-sender control must pass coverage"
        );

        // Reordering cannot change the sender set, so the same control remains valid.
        assert!(
            !sender_coverage_ok(&dag, &nonbonded_replacement).await.unwrap(),
            "non-bonded replacement must fail sender-set coverage"
        );
    }
}
