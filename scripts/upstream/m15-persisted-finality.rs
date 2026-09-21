// M15 — persisted DAG finality-state witness.
//
// Injected into casper/src/dag.rs. Reuses the exact upstream BlockDagKeyValueStorage
// test harness and helper constructors already present in the pinned revision.

#[cfg(test)]
mod m15_persisted_finality_state {
    use super::*;
    use rchain_block_storage::dag::codecs::{
        Blake2b256HashCodec, BlockHashCodec, BlockMetadataCodec, FringeDataCodec,
        SignedDeployDataCodec,
    };
    use rchain_shared::typed_store::{BytesCodec, KeyValueTypedStoreCodec};
    use rchain_models::block::state_hash::StateHash;
    use rchain_shared::refined::{BlockHeight, NonNegI64, SeqNum};

    fn validator(byte: u8) -> Validator {
        Validator::new([byte; 65])
    }

    fn bonds() -> BTreeMap<Validator, NonNegI64> {
        BTreeMap::from([
            (validator(0), NonNegI64::try_from(70).unwrap()),
            (validator(1), NonNegI64::try_from(10).unwrap()),
            (validator(2), NonNegI64::try_from(10).unwrap()),
            (validator(3), NonNegI64::try_from(10).unwrap()),
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

    fn hash(byte: u8) -> BlockHash {
        let mut bytes = [0u8; 32];
        bytes[0] = byte;
        BlockHash::new(bytes)
    }

    fn blank_block(id: BlockHash) -> BlockMessage {
        BlockMessage {
            version: 1,
            shard_id: "root".to_string(),
            block_hash: id,
            block_number: 0.try_into().unwrap(),
            sender: validator(0),
            seq_num: 0.try_into().unwrap(),
            pre_state_hash: StateHash::new([0u8; 32]),
            post_state_hash: StateHash::new([0u8; 32]),
            justifications: Vec::new(),
            bonds: BTreeMap::new(),
            rejected_deploys: BTreeSet::new(),
            rejected_blocks: BTreeSet::new(),
            rejected_senders: BTreeSet::new(),
            state: rchain_models::casper::protocol::casper_message::RholangState::default(),
            sig_algorithm: "secp256k1".to_string(),
            sig: Vec::new(),
            timestamp: 0,
        }
    }

    async fn build_storage_local() -> Arc<BlockDagKeyValueStorage> {
        type Shared = Arc<tokio::sync::Mutex<Box<dyn rchain_shared::store::KeyValueStore + Send + Sync>>>;

        fn in_memory() -> Shared {
            Arc::new(tokio::sync::Mutex::new(Box::new(
                rchain_shared::store::InMemoryKeyValueStore::default(),
            )))
        }

        let metadata_store = Arc::new(
            BlockMetadataStore::create(Arc::new(KeyValueTypedStoreCodec::new(
                in_memory(),
                Arc::new(BlockHashCodec),
                Arc::new(BlockMetadataCodec),
            )))
            .await
            .unwrap(),
        );
        let fringe_store: Arc<dyn KeyValueTypedStore<rchain_crypto::hash::blake2b256_hash::Blake2b256Hash, FringeData>> =
            Arc::new(KeyValueTypedStoreCodec::new(
                in_memory(),
                Arc::new(Blake2b256HashCodec),
                Arc::new(FringeDataCodec),
            ));
        let deploy_index: Arc<dyn KeyValueTypedStore<DeployId, BlockHash>> =
            Arc::new(KeyValueTypedStoreCodec::new(
                in_memory(),
                Arc::new(BytesCodec),
                Arc::new(BlockHashCodec),
            ));
        let deploy_store: Arc<dyn KeyValueTypedStore<DeployId, SignedDeployData>> =
            Arc::new(KeyValueTypedStoreCodec::new(
                in_memory(),
                Arc::new(BytesCodec),
                Arc::new(SignedDeployDataCodec),
            ));
        Ok::<_, String>(
            BlockDagKeyValueStorage::create(
                metadata_store,
                fringe_store,
                deploy_index,
                deploy_store,
            )
            .await
            .unwrap()
        )
    }

    #[tokio::test]
    async fn m15_under_cardinality_fringe_persists_into_global_finality_state() {
        let storage = build_storage_local().await;

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
        let candidate = hash(41);

        for (id, sender, num, seq) in [
            (g0, validator(0), 0, 0),
            (g1, validator(1), 0, 0),
            (g2, validator(2), 0, 0),
            (g3, validator(3), 0, 0),
        ] {
            storage
                .insert(
                    metadata(id, sender, num, seq, &[], &[]),
                    blank_block(id),
                )
                .await
                .unwrap();
        }

        for (id, sender, parent) in [
            (a1, validator(0), g0),
            (b1, validator(1), g1),
            (c1, validator(2), g2),
            (d1, validator(3), g3),
        ] {
            storage
                .insert(
                    metadata(id, sender, 1, 1, &[parent], &[]),
                    blank_block(id),
                )
                .await
                .unwrap();
        }

        let layer_one = [a1, b1, c1, d1];
        for (id, sender) in [
            (a2, validator(0)),
            (b2, validator(1)),
            (c2, validator(2)),
            (d2, validator(3)),
        ] {
            storage
                .insert(
                    metadata(id, sender, 2, 2, &layer_one, &[]),
                    blank_block(id),
                )
                .await
                .unwrap();
        }

        let layer_two = [a2, b2, c2, d2];
        for (id, sender) in [
            (a3, validator(0)),
            (b3, validator(1)),
            (c3, validator(2)),
        ] {
            storage
                .insert(
                    metadata(id, sender, 3, 3, &layer_two, &[]),
                    blank_block(id),
                )
                .await
                .unwrap();
        }

        // This is the M11 duplicate-sender justification shape:
        // two v0 justifications, plus v1 and v2. The finalized fringe supplied
        // by the preceding Finalizer probe contains only a1/b1/c1.
        let persisted_fringe = [a1, b1, c1];
        let parent_justifications = [a2, a3, b3, c3];

        storage
            .insert(
                metadata(
                    candidate,
                    validator(0),
                    4,
                    4,
                    &parent_justifications,
                    &persisted_fringe,
                ),
                blank_block(candidate),
            )
            .await
            .unwrap();

        let candidate_meta = storage.lookup(&candidate).await.unwrap().unwrap();
        assert_eq!(
            candidate_meta.fringe,
            persisted_fringe.into_iter().collect::<BTreeSet<_>>()
        );

        let representation = storage.get_representation().await;
        let latest_fringe = representation.latest_fringe();
        let latest_fringe_ids: BTreeSet<_> =
            latest_fringe.iter().map(|m| m.id).collect();

        assert_eq!(
            latest_fringe_ids,
            persisted_fringe.into_iter().collect::<BTreeSet<_>>()
        );
        assert_eq!(latest_fringe.len(), 3);

        // Global finality is the seen-closure of the latest fringe.
        assert!(representation.is_finalized(&a1));
        assert!(representation.is_finalized(&b1));
        assert!(representation.is_finalized(&c1));

        // The bonded v3 branch is absent from the persisted three-member fringe,
        // so its d2 message is not marked finalized by the same global helper.
        assert!(!representation.is_finalized(&d2));

        let finalized = representation.finalized_blocks_set();
        assert!(finalized.contains(&a1));
        assert!(finalized.contains(&b1));
        assert!(finalized.contains(&c1));
        assert!(!finalized.contains(&d2));
    }
}
