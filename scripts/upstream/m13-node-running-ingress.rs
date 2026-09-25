// M13 — NodeRunning production-dispatch boundary, injected into the pinned upstream
// casper/src/engine/node_running.rs.
//
// This probe closes the transport-dispatch seam above M12:
//   CasperMessage::BlockMessage
//        -> NodeRunning::handle
//        -> bounded incoming_blocks queue
//
// It deliberately stops before BlockReceiver. M12 proves the next ingress stage.

#[cfg(test)]
mod m13_node_running_dispatch_boundary {
    use std::collections::{BTreeMap, BTreeSet};
    use std::sync::Arc;
    use std::time::Duration;

    use async_trait::async_trait;

    use rchain_block_storage::block_store::BlockStore;
    use rchain_block_storage::dag::codecs::{BlockHashCodec, BlockMessageCodec};
    use rchain_block_storage::dag::dag_storage::{BlockDagStorage, DeployId};
    use rchain_block_storage::dag::message_state::DagMessageState;
    use rchain_block_storage::dag::representation::DagRepresentation;
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
        BlockMessage, CasperMessage, RholangState, SignedDeployData,
    };
    use rchain_models::comm::protocol::Protocol;
    use rchain_models::validator::Validator;
    use rchain_rspace::state::RSpaceExporter;
    use rchain_shared::log::NopLog;
    use rchain_shared::refined::{BlockHeight, NonNegI64, SeqNum};
    use rchain_shared::state::{TrieExporter, TrieNode};
    use rchain_shared::store::InMemoryKeyValueStore;
    use rchain_shared::typed_store::KeyValueTypedStoreCodec;

    use crate::blocks::block_retriever::BlockRetriever;
    use crate::engine::node_running::NodeRunning;
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

    struct MockExporter;

    impl TrieExporter<Blake2b256Hash> for MockExporter {
        fn get_nodes(
            &self,
            _start_path: &[(Blake2b256Hash, Option<u8>)],
            _skip: usize,
            _take: usize,
        ) -> Vec<TrieNode<Blake2b256Hash>> {
            Vec::new()
        }

        fn get_history_items<Value>(
            &self,
            _keys: &[Blake2b256Hash],
            _from_buffer: impl Fn(&[u8]) -> Value,
        ) -> Vec<(Blake2b256Hash, Value)> {
            Vec::new()
        }

        fn get_data_items<Value>(
            &self,
            _keys: &[Blake2b256Hash],
            _from_buffer: impl Fn(&[u8]) -> Value,
        ) -> Vec<(Blake2b256Hash, Value)> {
            Vec::new()
        }
    }

    impl RSpaceExporter for MockExporter {
        fn get_root(&self) -> Option<Blake2b256Hash> {
            None
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

    fn candidate() -> BlockMessage {
        let identity = ValidatorIdentity::from_hex(
            "67e56582298859ddae725f972992a07c6c4fb9f62a8fff58ce3ca926a1063530",
        )
        .expect("fixed test validator identity");
        let sender = Validator::from_slice(identity.public_key.bytes());

        let unsigned = unsigned_block_proto(
            1,
            "root".to_string(),
            BlockHeight::try_from(1).unwrap(),
            sender,
            SeqNum::try_from(1).unwrap(),
            StateHash::new([1u8; 32]),
            StateHash::new([2u8; 32]),
            vec![hash(10), hash(11), hash(12), hash(13), hash(14)],
            BTreeMap::new(),
            BTreeSet::new(),
            RholangState::default(),
            0,
        );
        identity.sign_block(&unsigned).unwrap()
    }

    #[tokio::test]
    async fn m13_node_running_forwards_wire_valid_duplicate_sender_candidate() {
        let candidate = candidate();
        let local = peer("local", 40400);
        let remote = peer("remote", 40401);
        let transport = Arc::new(MockTransport::default());
        let connections: ConnectionsCell = Arc::new(tokio::sync::RwLock::new(Vec::new()));
        let comm_util = Arc::new(CommUtil::new(
            transport.clone(),
            conf(&local),
            connections,
            Arc::new(NopLog),
        ));
        let retriever = Arc::new(BlockRetriever::new(comm_util, Arc::new(NopLog)));

        let store = block_store(Vec::new()).await;
        let dag: Arc<dyn BlockDagStorage> = Arc::new(MockDag {
            representation: DagRepresentation {
                dag_set: BTreeSet::new(),
                child_map: BTreeMap::new(),
                height_map: BTreeMap::new(),
                dag_message_state: DagMessageState {
                    latest_msgs: BTreeMap::new(),
                    msg_map: BTreeMap::new(),
                },
                fringe_states: BTreeMap::new(),
            },
        });

        let (incoming_tx, mut incoming_rx) =
            tokio::sync::mpsc::channel::<BlockMessage>(super::MAX_PENDING_BLOCKS);

        let running = NodeRunning::new(
            transport,
            conf(&local),
            store.clone(),
            dag,
            retriever,
            Arc::new(NopLog),
            None,
            incoming_tx,
            MockExporter,
        );

        running
            .handle(&remote, &CasperMessage::BlockMessage(candidate.clone()))
            .await;

        let forwarded = tokio::time::timeout(
            Duration::from_secs(1),
            incoming_rx.recv(),
        )
        .await
        .expect("NodeRunning did not forward the BlockMessage")
        .expect("NodeRunning inbound queue closed unexpectedly");

        assert_eq!(forwarded.block_hash, candidate.block_hash);
        assert_eq!(forwarded.justifications, candidate.justifications);

        // NodeRunning intentionally does not perform block hash/signature validation here;
        // M12 proves the downstream BlockReceiver performs those production ingress checks.
        let known = store
            .contains(&[candidate.block_hash])
            .await
            .unwrap_or_default()
            .first()
            .copied()
            .unwrap_or(false);
        assert!(!known, "NodeRunning dispatch must not pre-store the block");
    }
}
