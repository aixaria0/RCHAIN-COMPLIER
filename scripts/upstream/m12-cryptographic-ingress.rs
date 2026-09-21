// M12 — production-ingress boundary probe, injected into the pinned upstream
// casper/src/blocks/block_receiver.rs for an exact-revision test.
//
// This test deliberately stops at the receiver boundary:
//   wire-valid BlockMessage
//        -> block hash validation
//        -> signature validation
//        -> BlockReceiverState / BlockReceiver::apply
//        -> ready-for-validation queue
//
// It does NOT claim that the block survives full Casper validation. M11.6/M11.7
// cover that boundary separately. The purpose here is to close the remaining
// assumption that the duplicate-sender shape is merely a synthetic in-memory
// object with an impossible wire representation.

#[cfg(test)]
mod m12_cryptographic_ingress_boundary {
    use std::collections::{BTreeMap, BTreeSet};
    use std::sync::Arc;
    use std::time::Duration;

    use async_trait::async_trait;

    use rchain_block_storage::block_store::BlockStore;
    use rchain_block_storage::dag::codecs::{BlockHashCodec, BlockMessageCodec};
    use rchain_block_storage::dag::dag_storage::{BlockDagStorage, DeployId};
    use rchain_block_storage::dag::message_state::DagMessageState;
    use rchain_block_storage::dag::representation::DagRepresentation;
    use rchain_block_storage::dag::finalizer::Message;
    use rchain_comm::errors::CommErr;
    use rchain_comm::peer_node::{NodeIdentifier, PeerNode};
    use rchain_comm::rp::rp_conf::{ClearConnectionsConf, RPConf};
    use rchain_comm::transport::chunker::Blob;
    use rchain_comm::transport::transport_layer::TransportLayer;
    use rchain_crypto::hash::blake2b256_hash::Blake2b256Hash;
    use rchain_models::block::state_hash::StateHash;
    use rchain_models::block_hash::BlockHash;
    use rchain_models::block_metadata::BlockMetadata;
    use rchain_models::casper::protocol::casper_message::{
        BlockMessage, RholangState, SignedDeployData,
    };
    use rchain_models::comm::protocol::Protocol;
    use rchain_models::validator::Validator;
    use rchain_shared::log::{LogSource, NopLog};
    use rchain_shared::refined::{BlockHeight, NonNegI64, SeqNum};
    use rchain_shared::store::InMemoryKeyValueStore;
    use rchain_shared::typed_store::KeyValueTypedStoreCodec;

    use crate::blocks::block_retriever::BlockRetriever;
    use crate::protocol::comm_util::{CommUtil, ConnectionsCell};
    use crate::proto_util::unsigned_block_proto;
    use crate::validator_identity::ValidatorIdentity;

    fn hash(byte: u8) -> BlockHash {
        BlockHash::new([byte; 32])
    }

    fn validator(byte: u8) -> Validator {
        Validator::new([byte; 65])
    }

    fn peer(name: &str, port: u16) -> PeerNode {
        PeerNode::from(
            NodeIdentifier::new(name.as_bytes().to_vec()),
            "host".to_string(),
            rchain_shared::refined::Port::new(port),
            rchain_shared::refined::Port::new(port),
        )
    }

    fn conf(local: &PeerNode) -> RPConf {
        RPConf {
            local: local.clone(),
            network_id: "testnet".to_string(),
            bootstrap: None,
            default_timeout: Duration::from_secs(10),
            max_num_of_connections: 10,
            clear_connections: ClearConnectionsConf {
                num_of_connections_pinged: 10,
            },
        }
    }

    #[derive(Default)]
    struct MockTransport;

    #[async_trait]
    impl TransportLayer for MockTransport {
        async fn send(&self, _peer: &PeerNode, _msg: Protocol) -> CommErr<()> {
            Ok(())
        }

        async fn broadcast(
            &self,
            _peers: &[PeerNode],
            _msg: Protocol,
        ) -> Vec<CommErr<()>> {
            Vec::new()
        }

        async fn stream(&self, _peers: &[PeerNode], _blob: Blob) {}
    }

    struct MockDag {
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

        async fn lookup(&self, _h: &BlockHash) -> Result<Option<BlockMetadata>, String> {
            Ok(None)
        }

        async fn lookup_by_deploy_id(
            &self,
            _d: &DeployId,
        ) -> Result<Option<BlockHash>, String> {
            Ok(None)
        }

        async fn add_deploy(&self, _d: SignedDeployData) -> Result<(), String> {
            Ok(())
        }

        async fn pooled_deploys(
            &self,
        ) -> Result<BTreeMap<DeployId, SignedDeployData>, String> {
            Ok(BTreeMap::new())
        }

        async fn contains_deploy_in_pool(&self, _d: &DeployId) -> Result<bool, String> {
            Ok(false)
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
        let pairs = blocks
            .into_iter()
            .map(|b| (b.block_hash, b))
            .collect::<Vec<_>>();
        store.put(&pairs).await.unwrap();
        store
    }

    fn stored_parent_block(id: BlockHash, sender: Validator) -> BlockMessage {
        BlockMessage {
            version: 1,
            shard_id: "root".to_string(),
            block_hash: id,
            block_number: BlockHeight::zero(),
            sender,
            seq_num: SeqNum::try_from(0).unwrap(),
            pre_state_hash: StateHash::new([0u8; 32]),
            post_state_hash: StateHash::new([0u8; 32]),
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

    fn parent_message(
        id: BlockHash,
        sender: Validator,
    ) -> Message<BlockHash, Validator> {
        Message {
            id,
            height: BlockHeight::zero(),
            sender,
            sender_seq: SeqNum::try_from(0).unwrap(),
            bonds_map: BTreeMap::from([
                (validator(0), NonNegI64::try_from(70).unwrap()),
                (validator(1), NonNegI64::try_from(10).unwrap()),
                (validator(2), NonNegI64::try_from(10).unwrap()),
                (validator(3), NonNegI64::try_from(10).unwrap()),
            ]),
            parents: BTreeSet::new(),
            fringe: BTreeSet::new(),
            seen: BTreeSet::from([id]),
        }
    }

    fn duplicate_sender_fixture() -> (
        BlockMessage,
        BTreeMap<BlockHash, Message<BlockHash, Validator>>,
        Vec<BlockMessage>,
    ) {
        let p0a = hash(10);
        let p0b = hash(11);
        let p1 = hash(12);
        let p2 = hash(13);
        let p3 = hash(14);

        let identity = ValidatorIdentity::from_hex(
            "67e56582298859ddae725f972992a07c6c4fb9f62a8fff58ce3ca926a1063530",
        )
        .expect("fixed test validator identity");

        let sender = Validator::from_slice(identity.public_key.bytes());
        let candidate = unsigned_block_proto(
            1,
            "root".to_string(),
            BlockHeight::try_from(1).unwrap(),
            sender,
            SeqNum::try_from(1).unwrap(),
            StateHash::new([1u8; 32]),
            StateHash::new([2u8; 32]),
            vec![p0a, p0b, p1, p2, p3],
            BTreeMap::new(),
            BTreeSet::new(),
            RholangState::default(),
            0,
        );
        let candidate = identity.sign_block(&candidate).unwrap();

        let msg_map = BTreeMap::from([
            (p0a, parent_message(p0a, validator(0))),
            (p0b, parent_message(p0b, validator(0))),
            (p1, parent_message(p1, validator(1))),
            (p2, parent_message(p2, validator(2))),
            (p3, parent_message(p3, validator(3))),
        ]);

        let parent_blocks = vec![
            stored_parent_block(p0a, validator(0)),
            stored_parent_block(p0b, validator(0)),
            stored_parent_block(p1, validator(1)),
            stored_parent_block(p2, validator(2)),
            stored_parent_block(p3, validator(3)),
        ];

        (candidate, msg_map, parent_blocks)
    }

    #[tokio::test]
    async fn m12_wire_valid_duplicate_sender_candidate_crosses_block_receiver() {
        let (candidate, msg_map, _parent_blocks) = duplicate_sender_fixture();

        assert_eq!(
            candidate
                .justifications
                .iter()
                .map(|id| msg_map[id].sender)
                .collect::<Vec<_>>(),
            vec![
                validator(0),
                validator(0),
                validator(1),
                validator(2),
                validator(3),
            ]
        );

        // Exact production ingress predicates from BlockReceiver::check_if_of_interest.
        assert!(super::check_if_of_interest(
            &candidate,
            "root",
            &NopLog,
            LogSource::new("m12"),
        )
        .await);

        // Rebuild without the candidate so the receiver itself must store it.
        let (candidate, msg_map, parent_blocks) = duplicate_sender_fixture();
        let just_ids = candidate
            .justifications
            .iter()
            .copied()
            .collect::<BTreeSet<_>>();
        let dag: Arc<dyn BlockDagStorage> = Arc::new(MockDag {
            representation: DagRepresentation {
                dag_set: just_ids,
                child_map: BTreeMap::new(),
                height_map: BTreeMap::new(),
                dag_message_state: DagMessageState {
                    latest_msgs: BTreeMap::new(),
                    msg_map,
                },
                fringe_states: BTreeMap::new(),
            },
        });
        let store = block_store(parent_blocks).await;

        let local = peer("local", 40400);
        let transport = Arc::new(MockTransport::default());
        let connections: ConnectionsCell =
            Arc::new(tokio::sync::RwLock::new(Vec::new()));
        let comm_util = Arc::new(CommUtil::new(
            transport,
            conf(&local),
            connections,
            Arc::new(NopLog),
        ));
        let retriever = Arc::new(BlockRetriever::new(
            comm_util,
            Arc::new(NopLog),
        ));

        let state = Arc::new(tokio::sync::Mutex::new(
            super::BlockReceiverState::<BlockHash>::new(),
        ));
        let (incoming_tx, incoming_rx) =
            tokio::sync::mpsc::channel(super::MAX_PENDING_BLOCKS);
        let (_finished_tx, finished_rx) = tokio::sync::mpsc::unbounded_channel();

        let mut validation_rx = super::apply(
            state,
            incoming_rx,
            finished_rx,
            "root".to_string(),
            store.clone(),
            dag.clone(),
            retriever,
            Arc::new({
                let incoming_tx = incoming_tx.clone();
                move |block| {
                    let _ = incoming_tx.try_send(block);
                }
            }),
            Arc::new(NopLog),
        );

        incoming_tx
            .send(candidate.clone())
            .await
            .expect("candidate must enter receiver queue");

        let emitted = tokio::time::timeout(
            Duration::from_secs(3),
            validation_rx.recv(),
        )
        .await
        .expect("candidate did not reach the validation queue in time")
        .expect("receiver queue closed unexpectedly");

        assert_eq!(emitted, candidate.block_hash);

        let stored = store
            .get(&[candidate.block_hash])
            .await
            .expect("stored candidate lookup")
            .into_iter()
            .flatten()
            .next()
            .expect("receiver should store the admitted candidate");
        assert_eq!(stored.block_hash, candidate.block_hash);

        // The receiver has crossed only the ingress boundary here. The next
        // stage is full Casper validation, already covered by M11.6/M11.7.
    }
}
