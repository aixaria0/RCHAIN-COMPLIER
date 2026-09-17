import {
  runRealityEngine,
  verifyRealityCertificate,
  type RealityEngineInput,
} from "../src/lib/compiler/reality-engine.ts";
import { verifyRealityLoop } from "../src/lib/compiler/reality-loop.ts";

const input: RealityEngineInput = {
  record: {
    schema: "rchain-reality-record/v1",
    id: "engine-demo-001",
    subject: { id: "block-1842", kind: "rchain-block", label: "Synthetic Block 1842" },
    source: "synthetic-fixture",
    observations: [
      {
        id: "obs-block",
        source: "sentinel",
        type: "finalized-block",
        data: { blockHash: "0xabc1842", parentHash: "0xabc1841", height: 1842 },
      },
    ],
    claims: [
      {
        id: "claim-finality",
        statement: "block-1842 is canonically consistent and replayable",
        basis: ["obs-block"],
      },
    ],
    evidence: [
      {
        id: "e-block",
        observationIds: ["obs-block"],
        description: "synthetic finalized-block observation",
      },
    ],
    dependencies: [],
    transformations: [
      {
        id: "normalize-block",
        name: "canonicalize finalized block evidence",
        inputIds: ["obs-block"],
        outputIds: ["e-block"],
        deterministic: true,
      },
    ],
    verification: [
      {
        id: "v-canonical",
        predicate: "canonical_consistency",
        state: "VERIFIED",
        message: "parent linkage and block hash relation are consistent",
        evidenceIds: ["e-block"],
      },
    ],
    replay: {
      available: true,
      inputIds: ["obs-block"],
      expectedDigest: "replay-1842",
      observedDigest: "replay-1842",
      state: "REPRODUCED",
    },
  },
  propositions: [
    { id: "p-finality", statement: "block-1842 may be finalized" },
    { id: "p-not-rejected", statement: "block-1842 is not rejected" },
  ],
  bets: [
    {
      source: "validator-a",
      target: "validator-b",
      claim: "p-finality",
      belief: 1,
      justification: ["e-block"],
    },
  ],
};

const certificate = runRealityEngine(input);

console.log(JSON.stringify({
  state: certificate.state,
  certificateDigest: certificate.certificateDigest,
  recordDigest: certificate.record.integrity.recordDigest,
  propositionDigest: certificate.propositions.judgement.digest,
  fixedPoint: certificate.propositions.fixedPoint,
  loop: {
    phases: certificate.loop.phases,
    measurement: certificate.loop.measurement,
    projection: certificate.loop.projection,
    loopDigest: certificate.loop.loopDigest,
    verified: verifyRealityLoop(certificate.loop),
  },
  proof: {
    state: certificate.proof.proofState,
    satisfied: certificate.proof.satisfiedCount,
    open: certificate.proof.openCount,
    failed: certificate.proof.failedCount,
    obligations: certificate.proof.obligations,
    conflicts: certificate.proof.conflicts,
    graphNodes: certificate.proof.graph.nodes.length,
    graphEdges: certificate.proof.graph.edges.length,
  },
  equivocations: certificate.equivocations,
  verified: verifyRealityCertificate(certificate),
}, null, 2));
