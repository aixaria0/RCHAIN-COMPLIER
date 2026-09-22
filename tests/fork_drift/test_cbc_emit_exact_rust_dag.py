"""Generated Rust source contract: exact four distinct identities and no inferred finality."""
import importlib.util
import pathlib
import unittest

TOOL = pathlib.Path(__file__).resolve().parents[2] / "tools/cbc_emit_exact_rust_dag.py"
spec = importlib.util.spec_from_file_location("cbc_emit_exact_rust_dag", TOOL)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def packet():
    graph = {
        "bondsMap": {"v0": 70, "v1": 10, "v2": 10, "v3": 10},
        "messages": [
            {"id": "g0", "sender": "v0", "senderSeq": 0, "parents": [], "seen": ["g0"]},
            {"id": "g1", "sender": "v1", "senderSeq": 0, "parents": [], "seen": ["g1"]},
            {"id": "g2", "sender": "v2", "senderSeq": 0, "parents": [], "seen": ["g2"]},
            {"id": "a2", "sender": "v0", "senderSeq": 1, "parents": ["g0"], "seen": ["g0", "a2"]},
            {"id": "a3", "sender": "v0", "senderSeq": 2, "parents": ["a2"], "seen": ["g0", "a2", "a3"]},
            {"id": "b3", "sender": "v1", "senderSeq": 1, "parents": ["g1"], "seen": ["g1", "b3"]},
            {"id": "c3", "sender": "v2", "senderSeq": 1, "parents": ["g2"], "seen": ["g2", "c3"]},
        ],
        "justifications": ["a2", "a3", "b3", "c3"],
    }
    body = {
        "schema": module.SCHEMA,
        "sourceCommit": module.SOURCE_SHA,
        "selection": "MODEL_CANDIDATE_READY_FOR_INDEPENDENT_RUST_REPLAY",
        "rustReplayVerified": False,
        "wireIngressVerified": False,
        "selectedJustificationIds": list(graph["justifications"]),
        "sourceGraph": graph,
        "exactGraphSha256": module.digest(module.canonical(graph)),
    }
    return {**body, "packetSha256": module.digest(module.canonical(body))}


class ExactRustEmitterTests(unittest.TestCase):
    def test_exact_source_dag_and_identity_survive_translation(self):
        value = packet()
        source = module.emit(value)
        self.assertIn('msg("a2", "v0", 1, &["g0"], &["g0", "a2"])', source)
        self.assertIn('msg("a3", "v0", 2, &["a2"], &["g0", "a2", "a3"])', source)
        self.assertIn('let ids: BTreeSet<String> = &["a2", "a3", "b3", "c3"]', source)
        self.assertIn("finalizer.calculate_finalization(&justifications, &bonds)", source)
        self.assertIn('ARIA_EXACT_DAG_V1|graph_sha256=', source)
        self.assertIn(value["exactGraphSha256"], source)
        self.assertNotIn('assert!(new_fringe.is_some())', source)

    def test_tampered_packet_or_graph_rejected(self):
        value = packet()
        value["sourceGraph"]["messages"][3]["sender"] = "v3"
        with self.assertRaisesRegex(ValueError, "Packet integrity"):
            module.emit(value)
        value = packet()
        value["sourceGraph"]["messages"][3]["sender"] = "v3"
        value["packetSha256"] = module.digest(module.canonical(
            {k: v for k, v in value.items() if k != "packetSha256"}))
        with self.assertRaisesRegex(ValueError, "Source DAG integrity"):
            module.emit(value)

    def test_three_or_duplicate_justification_ids_rejected(self):
        for ids in (["a2", "a2", "b3", "c3"], ["a2", "b3", "c3"]):
            value = packet()
            value["sourceGraph"]["justifications"] = ids
            value["selectedJustificationIds"] = list(ids)
            value["exactGraphSha256"] = module.digest(module.canonical(value["sourceGraph"]))
            value["packetSha256"] = module.digest(module.canonical(
                {k: v for k, v in value.items() if k != "packetSha256"}))
            with self.assertRaisesRegex(ValueError, "Four distinct IDs"):
                module.emit(value)

    def test_false_independent_rust_claim_is_required(self):
        value = packet()
        value["rustReplayVerified"] = True
        value["packetSha256"] = module.digest(module.canonical(
            {k: v for k, v in value.items() if k != "packetSha256"}))
        with self.assertRaisesRegex(ValueError, "silently elevated"):
            module.emit(value)


if __name__ == "__main__":
    unittest.main()
