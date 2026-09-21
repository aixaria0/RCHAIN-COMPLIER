// M23 — admitted candidate -> persisted DAG -> next proposal bridge.
//
// This closes the gap between M21/M22 admission evidence and M19/M20
// propagation evidence. The candidate first crosses the real active
// block_summary path, is then inserted into the real DAG storage, and
// finally becomes input to the real DagMessageState proposal constructor.

#[cfg(test)]
mod m23_admission_to_proposal_bridge {
    use super::*;
    use std::collections::{BTreeMap, BTreeSet};
    use std::sync::Arc;

    use rchain_block_storage::block_store::BlockStore;
    use rchain_block_storage::dag::codecs::{BlockHashCodec, BlockMessageCodec};
    use rchain_models::block::state_hash::StateHash;
    use rchain_models::block_metadata::BlockMetadata;
    use rchain_models::casper::protocol::casper_message::BlockMessage;
    use rchain_models::validator::Validator;
    use rchain_shared::refined::{BlockHeight, SeqNum};
    use rchain_shared::store::InMemoryKeyValueStore;
    use rchain_shared::typed_store::KeyValueTypedStoreCodec;
    use rchain_casper::validate::block_summary;

    fn hash(byte: u8) -> BlockHash {
        BlockHash::new([byte; 32])
    }

    fn validator(byte: u8) -> Validator {
        Validator::new([byte; 65])
    }

    fn bonds() -> BTreeMap<Validator, rchain_shared::refined::NonNegI64> {
        BTreeMap::from([
            (validator(0), 25.try_into().unwrap()),
            (validator(1), 25.try_into().unwrap()),
            (validator(2), 25.try_into().unwrap()),
            (validator(3), 25.try_into().unwrap()),
        ])
    }

    fn metadata(
        id: BlockHash,
        sender: Validator,
        block_num: i64,
        seq: i64,
        justifications: &[BlockHash],
        fringe: &[BlockHash],
    ) -> BlockMetadata {
        BlockMetadata {
            block_hash: id,
            block_num: BlockHeight::try_from(block_num).unwrap(),
            sender,
            seq_num: SeqNum::try_from(seq).unwrap(),
            justifications: justifications.iter().copied().collect(),
            bonds_map: bonds(),
            validated: true,
            validation_failed: false,
            fringe: fringe.iter().copied().collect(),
            fringe_state_hash: StateHash::new([0u8; 32]),
            member_of_fringe: None,
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
            pre_state_hash: StateHash::new([1u8; 32]),
            post_state_hash: StateHash::new([2u8; 32]),
            justifications,
            bonds: bonds(),
            rejected_deploys: BTreeSet::new(),
            rejected_blocks: BTreeSet::new(),
            rejected_senders: BTreeSet::new(),
            state: rchain_models::casper::protocol::casper_message::RholangState::default(),
            sig_algorithm: "secp256k1".to_string(),
            sig: vec![1],
            timestamp: 0,
        }
    }

    async fn block_store(blocks: Vec<BlockMessage>) -> BlockStore {
        let store: BlockStore = Arc::new(KeyValueTypedStoreCodec::new(
            Arc::new(tokio::sync::Mutex::new(Box::new(InMemoryKeyValueStore::default()))),
            Arc::new(BlockHashCodec),
            Arc::new(BlockMessageCodec),
        ));
        let pairs = blocks.into_iter().map(|b| (b.block_hash, b)).collect::<Vec<_>>();
        store.put(&pairs).await.unwrap();
        store
    }

    #[tokio::test]
    async fn m23_admission_to_proposal_bridge() {
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
        let candidate_id = hash(41);

        let storage = {
            use rchain_block_storage::dag::codecs::{
                Blake2b256HashCodec, BlockMetadataCodec, FringeDataCodec, SignedDeployDataCodec,
            };
            use rchain_block_storage::dag::dag_storage::DeployId;
            use rchain_block_storage::dag::BlockDagKeyValueStorage;
            use rchain_models::fringe_data::FringeData;
            use rchain_shared::typed_store::{BytesCodec, KeyValueTypedStoreCodec};
            type Shared = Arc<tokio::sync::Mutex<Box<dyn rchain_shared::store::KeyValueStore + Send + Sync>>>;
            let mem = || -> Shared { Arc::new(tokio::sync::Mutex::new(Box::new(InMemoryKeyValueStore::default()))) };
            let metadata_store = Arc::new(
                rchain_casper::block_metadata_store::BlockMetadataStore::create(
                    Arc::new(KeyValueTypedStoreCodec::new(mem(), Arc::new(BlockHashCodec), Arc::new(BlockMetadataCodec)))
                ).await.unwrap(),
            );
            let fringe_store: Arc<dyn rchain_shared::typed_store::KeyValueTypedStore<rchain_crypto::hash::blake2b256_hash::Blake2b256Hash, FringeData>> = Arc::new(KeyValueTypedStoreCodec::new(mem(), Arc::new(Blake2b256HashCodec), Arc::new(FringeDataCodec)));
            let deploy_index: Arc<dyn rchain_shared::typed_store::KeyValueTypedStore<DeployId, BlockHash>> = Arc::new(KeyValueTypedStoreCodec::new(mem(), Arc::new(BytesCodec), Arc::new(BlockHashCodec)));
            let deploy_store: Arc<dyn rchain_shared::typed_store::KeyValueTypedStore<DeployId, rchain_models::casper::protocol::casper_message::SignedDeployData>> = Arc::new(KeyValueTypedStoreCodec::new(mem(), Arc::new(BytesCodec), Arc::new(SignedDeployDataCodec)));
            BlockDagKeyValueStorage::create(metadata_store, fringe_store, deploy_index, deploy_store).await.unwrap()
        };

        for (id, sender, num, seq) in [
            (g0, v0, 0, 0), (g1, v1, 0, 0), (g2, v2, 0, 0), (g3, v3, 0, 0),
        ] {
            storage.insert(metadata(id, sender, num, seq, &[], &[]), block(id, sender, num, seq, vec![])).await.unwrap();
        }

        for (id, sender, parent) in [
            (a1, v0, g0), (b1, v1, g1), (c1, v2, g2), (d1, v3, g3),
        ] {
            storage.insert(metadata(id, sender, 1, 1, &[parent], &[]), block(id, sender, 1, 1, vec![parent])).await.unwrap();
        }

        let layer_one = [a1, b1, c1, d1];
        for (id, sender) in [(a2, v0), (b2, v1), (c2, v2), (d2, v3)] {
            storage.insert(metadata(id, sender, 2, 2, &layer_one, &[]), block(id, sender, 2, 2, layer_one.to_vec())).await.unwrap();
        }

        let layer_two = [a2, b2, c2, d2];
        for (id, sender) in [(a3, v0), (b3, v1), (c3, v2)] {
            storage.insert(metadata(id, sender, 3, 3, &layer_two, &[]), block(id, sender, 3, 3, layer_two.to_vec())).await.unwrap();
        }

        // Duplicate-sender witness: v0 occurs twice; v3 is absent.
        let duplicate_justifications = vec![a2, a3, b3, c3];
        let store = block_store(vec![
            block(a2, v0, 2, 2, layer_one.to_vec()),
            block(a3, v0, 3, 3, layer_two.to_vec()),
            block(b3, v1, 3, 3, layer_two.to_vec()),
            block(c3, v2, 3, 3, layer_two.to_vec()),
        ]).await;
        let candidate = block(candidate_id, v0, 4, 4, duplicate_justifications.clone());

        // Stage 1: the real active validation summary accepts the duplicate sender shape.
        let admission = block_summary(&storage, &store, &candidate, "root", 50, 0).await.unwrap();
        assert_eq!(admission, Ok(()), "candidate must cross active block_summary");

        // Stage 2: persist the admitted metadata through the real DAG storage.
        let under_cardinality_fringe = [a1, b1, c1];
        storage.insert(
            metadata(candidate_id, v0, 4, 4, &duplicate_justifications, &under_cardinality_fringe),
            candidate.clone(),
        ).await.unwrap();

        let repr = storage.get_representation().await;
        let latest_fringe_ids: BTreeSet<_> = repr.latest_fringe().iter().map(|m| m.id).collect();
        assert_eq!(latest_fringe_ids, under_cardinality_fringe.into_iter().collect());
        assert_eq!(repr.latest_fringe().len(), 3);

        // Stage 3: the real proposal-state constructor consumes that persisted view.
        let justifications: BTreeSet<_> = repr.dag_message_state.latest_msgs.values().cloned().collect();
        let proposal = repr.dag_message_state.create_message(
            hash(42),
            BlockHeight::try_from(5).unwrap(),
            v1,
            SeqNum::try_from(4).unwrap(),
            bonds(),
            &justifications,
        );

        assert_eq!(proposal.fringe, under_cardinality_fringe.into_iter().collect());
        assert_eq!(repr.dag_message_state.latest_msgs.len(), 4);

        // The missing v3 sender is not repaired by DAG insertion or proposal construction.
        assert!(!proposal.fringe.contains(&d1));
    }
}