export type Status = "PASS" | "WARN" | "FAIL" | "UNAVAILABLE";
export type Severity = "INFO" | "WARNING" | "CRITICAL";

export type ScenarioId =
  | "exchange-commit"
  | "exchange-abort"
  | "hello-rho"
  | "cap-payment";

export type MutationId =
  | "none"
  | "node-c-lied"
  | "drop-capability"
  | "force-abort"
  | "dup-validator"
  | "no-justification"
  | "tamper-trace";

export type LayerId =
  | "quantumos"
  | "qlf"
  | "rholang"
  | "rspace"
  | "rchain"
  | "block"
  | "sentinel"
  | "lattice"
  | "verification";

export interface EvidenceRef {
  source: string;
  field: string;
  value: string;
}

export interface Claim {
  layer: LayerId;
  statement: string;
  status: Status;
  basis: string;
  notClaimed: string;
}

export interface Invariant {
  id: string;
  layer: LayerId;
  name: string;
  status: Status;
  severity: Severity;
  detail: string;
  evidence: EvidenceRef[];
}

export interface FailureWitness {
  layer: LayerId;
  invariantId: string;
  invariant: string;
  expected: string;
  observed: string;
  source: string;
  field: string;
  impact: string;
  verification: Status;
}

export interface VerificationCheck {
  id: string;
  name: string;
  status: Status;
  severity: Severity;
  message: string;
  source: string;
  evidence: EvidenceRef[];
}

export const LAYERS: { id: LayerId; label: string; repo: string; role: string }[] = [
  {
    id: "quantumos",
    label: "QuantumOS",
    repo: "rchain-community/quantum-os",
    role: "origin of interaction — room, peer, capability, lemma",
  },
  {
    id: "qlf",
    label: "QLF / ZFA",
    repo: "rchain-community/quantum-logical-framework",
    role: "event-level logical certificate — phase string, closure, spectral mode",
  },
  {
    id: "rholang",
    label: "Rholang",
    repo: "rchain-community/rchain-rust",
    role: "executable process — new / send / receive / contract",
  },
  {
    id: "rspace",
    label: "ρ-calculus / rspace",
    repo: "rchain-community/rchain-rust",
    role: "COMM reduction over the tuple space",
  },
  {
    id: "rchain",
    label: "rchain-rust",
    repo: "rchain-community/rchain-rust",
    role: "deployment, execution, block creation",
  },
  {
    id: "block",
    label: "Block",
    repo: "RevDefine/revdefine",
    role: "recorded state transition — hash, parent, proposer, deploys",
  },
  {
    id: "sentinel",
    label: "Sentinel",
    repo: "aixaria0/rchain-sentinel",
    role: "independent observation + cross-node evidence",
  },
  {
    id: "lattice",
    label: "Sovereign Lattice",
    repo: "aixaria0/Sovereign-Lattice",
    role: "independent BFT certificate / quorum analysis",
  },
  {
    id: "verification",
    label: "Verification",
    repo: "Reality Compiler",
    role: "result stated with its evidence basis — not a proof of Casper finality",
  },
];
