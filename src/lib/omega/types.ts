export type OmegaState = "ONLINE" | "DEGRADED" | "COMPROMISED";

export interface OmegaProcessStatus {
  index: number;
  pid: number;
  endpoint: string;
  expectedActorId: string;
  observedActorId: string | null;
  healthy: boolean;
  identityValid: boolean;
  eventCount: number | null;
}

export interface OmegaStatus {
  schema: "omega-status/v1";
  state: OmegaState;
  nodeId: string;
  bootId: string;
  checkedAt: string;
  policyDigest: string;
  eventRoot: string | null;
  processes: {
    expected: 3;
    alive: number;
    unique: number;
    members: OmegaProcessStatus[];
  };
  workers: {
    required: 2;
    verified: number;
  };
  identity: "PASS" | "FAIL";
  replay: "PASS" | "FAIL";
  registry: "PASS" | "FAIL";
  equivocations: number;
  reasons: string[];
}

export interface OmegaProofPayload {
  schema: "omega-proof-payload/v1";
  nodeId: string;
  bootId: string;
  issuedAt: string;
  expiresAt: string;
  policyDigest: string;
  ownerActorId: string;
  ownerPublicKeyHex: string;
  eventRoot: string;
  status: OmegaStatus;
}

export interface OmegaProof {
  schema: "omega-proof/v1";
  payload: OmegaProofPayload;
  signatureHex: string;
}

export interface OmegaTrust {
  schema: "omega-trust/v1";
  expectedNodeId: string;
  expectedPolicyDigest: string;
  expectedOwnerActorId: string;
  expectedOwnerPublicKeyHex: string;
}

export interface OmegaProofReport {
  schema: "omega-proof-report/v1";
  status: "PASS" | "FAIL";
  code:
    | "VERIFIED"
    | "INVALID_PROOF"
    | "TRUST_MISMATCH"
    | "EXPIRED"
    | "NODE_NOT_ONLINE";
  reason: string;
  nodeId: string | null;
  bootId: string | null;
  eventRoot: string | null;
}
