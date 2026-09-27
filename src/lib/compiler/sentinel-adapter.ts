import { digest, hexPrefixed } from "./hash.ts";
import {
  sealRealityRecord,
  type RealityClaim,
  type RealityDependency,
  type RealityEvidence,
  type RealityObservation,
  type RealityRecord,
  type RealityTransformation,
  type RealityVerification,
} from "./reality-record.ts";

export const SENTINEL_ENDPOINTS = {
  health: "/health",
  networkStatus: "/api/network/status",
  finalizedBlockEvidence: "/api/evidence/last-finalized-block",
  networkVerification: "/api/verify",
  blockVerification: "/api/verify/block",
  casperVerification: "/api/verify/casper",
  crossNodeVerification: "/api/verify/cross-node",
  attestationSnapshot: "/api/attestation/snapshot",
  realityEvent: (eventId: string) => `/api/reality/event/${encodeURIComponent(eventId)}`,
  realityReplay: (eventId: string) => `/api/reality/replay/${encodeURIComponent(eventId)}`,
} as const;

export interface SentinelFinalizedBlockEvidence {
  available: boolean;
  raw: Record<string, unknown> | null;
  payload_sha256: string | null;
  block_hash: string | null;
  parent_hash: string | null;
  proposer: string | null;
  signature: string | null;
  justification_present: boolean;
  full_block_available: boolean;
  full_block: Record<string, unknown> | null;
  full_block_hash: string | null;
  node_reported_finalized: boolean | null;
  finality_hash_match: boolean | null;
  canonical_consistency: boolean | null;
  canonical_mismatches: string[];
  finality_error: string | null;
  error: string | null;
}

export interface SentinelNetworkStatus {
  reachable: boolean;
  node_url: string;
  latency_ms: number | null;
  http_status: number | null;
  probe: string;
  error: string | null;
  rnode: {
    node?: {
      id?: string | null;
      host?: string | null;
      port?: number | null;
    } | null;
    network_id?: string | null;
    shard_id?: string | null;
    latest_block_number?: number | null;
    last_finalized_block_number?: number | null;
    validator?: boolean | null;
    ready?: boolean | null;
    current_epoch?: number | null;
  } | null;
}

export interface SentinelCrossNodeAgreement {
  node_url: string;
  reachable: boolean;
  finalized_height: number | null;
  block_hash: string | null;
  payload_sha256: string | null;
  proposer: string | null;
  signature_present: boolean;
  justification_present: boolean;
  full_block_available: boolean;
  full_block_hash_match: boolean | null;
  node_reported_finalized: boolean | null;
}

export interface SentinelCrossNodeReport {
  target_count: number;
  reachable_count: number;
  evidence_count: number;
  agreeing_nodes: number;
  quorum_required: number;
  quorum_observed: boolean;
  agreement_ratio: number;
  common_finalized_height: number | null;
  common_block_hash: string | null;
  height_agreement: boolean;
  hash_agreement: boolean;
  missing_height_nodes: number;
  missing_hash_nodes: number;
  conflicting_nodes: number;
  agreement: boolean;
  status: string;
  verification_basis: string;
  observations: SentinelCrossNodeAgreement[];
}

export interface SentinelObservationBundle {
  sentinelBaseUrl: string;
  collectedAt: string;
  evidence: SentinelFinalizedBlockEvidence;
  network?: SentinelNetworkStatus;
  crossNode?: SentinelCrossNodeReport;
}

function stableEvidenceId(bundle: SentinelObservationBundle): string {
  const identity = bundle.evidence.block_hash ?? bundle.evidence.payload_sha256 ?? "unavailable";
  return `sentinel:${identity}`;
}

function payloadDigest(value: unknown): string {
  return hexPrefixed(digest([JSON.stringify(value)]));
}

function blockObservation(bundle: SentinelObservationBundle): RealityObservation {
  const evidence = bundle.evidence;
  return {
    id: stableEvidenceId(bundle),
    source: "rchain-sentinel",
    type: "FinalizedBlockEvidence",
    timestamp: bundle.collectedAt,
    data: {
      endpoint: `${bundle.sentinelBaseUrl}${SENTINEL_ENDPOINTS.finalizedBlockEvidence}`,
      available: evidence.available,
      blockHash: evidence.block_hash,
      parentHash: evidence.parent_hash,
      proposer: evidence.proposer,
      signaturePresent: evidence.signature !== null,
      justificationPresent: evidence.justification_present,
      fullBlockAvailable: evidence.full_block_available,
      fullBlockHash: evidence.full_block_hash,
      nodeReportedFinalized: evidence.node_reported_finalized,
      finalityHashMatch: evidence.finality_hash_match,
      canonicalConsistency: evidence.canonical_consistency,
      canonicalMismatches: evidence.canonical_mismatches,
      finalityError: evidence.finality_error,
      error: evidence.error,
      payloadSha256: evidence.payload_sha256,
      rawDigest: payloadDigest(evidence.raw),
    },
  };
}

function networkObservation(bundle: SentinelObservationBundle): RealityObservation | null {
  if (!bundle.network) return null;
  const network = bundle.network;
  return {
    id: `sentinel-network:${payloadDigest(network)}`,
    source: "rchain-sentinel",
    type: "NetworkStatus",
    timestamp: bundle.collectedAt,
    data: {
      endpoint: `${bundle.sentinelBaseUrl}${SENTINEL_ENDPOINTS.networkStatus}`,
      reachable: network.reachable,
      nodeUrl: network.node_url,
      latencyMs: network.latency_ms,
      httpStatus: network.http_status,
      probe: network.probe,
      error: network.error,
      rnode: network.rnode,
    },
  };
}

function crossNodeObservation(bundle: SentinelObservationBundle): RealityObservation | null {
  if (!bundle.crossNode) return null;
  const report = bundle.crossNode;
  return {
    id: `sentinel-cross-node:${payloadDigest(report)}`,
    source: "rchain-sentinel",
    type: "CrossNodeReport",
    timestamp: bundle.collectedAt,
    data: {
      endpoint: `${bundle.sentinelBaseUrl}${SENTINEL_ENDPOINTS.crossNodeVerification}`,
      targetCount: report.target_count,
      reachableCount: report.reachable_count,
      evidenceCount: report.evidence_count,
      agreeingNodes: report.agreeing_nodes,
      quorumRequired: report.quorum_required,
      quorumObserved: report.quorum_observed,
      agreementRatio: report.agreement_ratio,
      commonFinalizedHeight: report.common_finalized_height,
      commonBlockHash: report.common_block_hash,
      heightAgreement: report.height_agreement,
      hashAgreement: report.hash_agreement,
      missingHeightNodes: report.missing_height_nodes,
      missingHashNodes: report.missing_hash_nodes,
      conflictingNodes: report.conflicting_nodes,
      agreement: report.agreement,
      status: report.status,
      verificationBasis: report.verification_basis,
      observationsDigest: payloadDigest(report.observations),
    },
  };
}

function evidenceForObservation(observation: RealityObservation): RealityEvidence {
  return {
    id: `evidence:${observation.id}`,
    observationIds: [observation.id],
    hash: payloadDigest(observation.data),
    description: `${observation.source} ${observation.type} observation`,
  };
}

function claimForBundle(bundle: SentinelObservationBundle, observation: RealityObservation): RealityClaim[] {
  const evidence = bundle.evidence;
  const claims: RealityClaim[] = [
    {
      id: "claim_sentinel_observed",
      statement: evidence.available
        ? "Sentinel observed a finalized-block evidence payload from its configured RNode target."
        : "Sentinel was unable to establish finalized-block evidence from its configured RNode target.",
      basis: [observation.id, "source:rchain-sentinel", `available:${evidence.available}`],
    },
  ];

  if (evidence.canonical_consistency !== null) {
    claims.push({
      id: "claim_canonical_consistency",
      statement:
        evidence.canonical_consistency
          ? "Sentinel reports that the canonical block payload is field-consistent with the observed protocol block."
          : "Sentinel reports a canonical block consistency mismatch.",
      basis: [observation.id, `canonical_consistency:${evidence.canonical_consistency}`],
    });
  }

  return claims;
}

function verificationForBundle(
  bundle: SentinelObservationBundle,
  evidenceId: string,
  crossNodeEvidenceId?: string,
): RealityVerification[] {
  const evidence = bundle.evidence;
  const checks: RealityVerification[] = [];
  if (evidence.available) {
    checks.push({
      id: "verify_sentinel_payload_available",
      predicate: "sentinel.finalized_block.available === true",
      state: "VERIFIED",
      message: "Sentinel returned a finalized-block evidence object.",
      evidenceIds: [evidenceId],
    });
  } else {
    checks.push({
      id: "verify_sentinel_payload_available",
      predicate: "sentinel.finalized_block.available === true",
      state: "INCOMPLETE",
      message: evidence.error ?? "Sentinel did not provide finalized-block evidence.",
      evidenceIds: [evidenceId],
    });
  }

  if (evidence.canonical_consistency !== null) {
    checks.push({
      id: "verify_sentinel_canonical_consistency",
      predicate: "sentinel.finalized_block.canonical_consistency === true",
      state: evidence.canonical_consistency ? "VERIFIED" : "DIVERGENT",
      message: evidence.canonical_consistency
        ? "Sentinel reports canonical payload consistency."
        : `Sentinel reported mismatches: ${evidence.canonical_mismatches.join(", ") || "unspecified"}.`,
      evidenceIds: [evidenceId],
    });
  }

  if (evidence.finality_hash_match !== null) {
    checks.push({
      id: "verify_sentinel_finality_hash",
      predicate: "sentinel.finalized_block.finality_hash_match === true",
      state: evidence.finality_hash_match ? "VERIFIED" : "DIVERGENT",
      message: evidence.finality_hash_match
        ? "Sentinel reports a matching finality hash."
        : "Sentinel reports a finality hash mismatch.",
      evidenceIds: [evidenceId],
    });
  }

  if (bundle.crossNode && crossNodeEvidenceId) {
    const report = bundle.crossNode;
    const enoughTargets = report.target_count >= 2;
    const consistent =
      enoughTargets &&
      report.agreement &&
      report.conflicting_nodes === 0 &&
      report.hash_agreement &&
      report.height_agreement;
    const divergent = report.conflicting_nodes > 0;
    checks.push({
      id: "verify_sentinel_cross_node_consistency",
      predicate: "sentinel.cross_node has >=2 targets and consistent height/hash observations",
      state: consistent ? "VERIFIED" : divergent ? "DIVERGENT" : "INCOMPLETE",
      message: consistent
        ? `Cross-node consistency observed across ${report.target_count} targets; this is not a stake-weighted Casper finality proof or proof of operator independence.`
        : report.verification_basis,
      evidenceIds: [crossNodeEvidenceId],
    });
  }

  return checks;
}

export function sentinelBundleToRecord(bundle: SentinelObservationBundle, previousDigest?: string): RealityRecord {
  const block = blockObservation(bundle);
  const network = networkObservation(bundle);
  const crossNode = crossNodeObservation(bundle);
  const observations = [block, ...(network ? [network] : []), ...(crossNode ? [crossNode] : [])];
  const blockEvidence = evidenceForObservation(block);
  const networkEvidence = network ? evidenceForObservation(network) : null;
  const crossNodeEvidence = crossNode ? evidenceForObservation(crossNode) : null;
  const evidence = [
    blockEvidence,
    ...(networkEvidence ? [networkEvidence] : []),
    ...(crossNodeEvidence ? [crossNodeEvidence] : []),
  ];
  const claims = claimForBundle(bundle, block);
  const verifications = verificationForBundle(bundle, blockEvidence.id, crossNodeEvidence?.id);

  const dependencies: RealityDependency[] = network
    ? [{ from: network.id, to: block.id, relation: "contextualizes" }]
    : [];

  const transformations: RealityTransformation[] = [
    {
      id: "transform_sentinel_finalized_block_to_reality_observation",
      name: "Sentinel finalized-block response → canonical observation",
      inputIds: [block.id],
      outputIds: [block.id],
      deterministic: true,
    },
  ];

  if (network) {
    transformations.push({
      id: "transform_sentinel_network_status_to_reality_observation",
      name: "Sentinel network status → canonical observation",
      inputIds: [network.id],
      outputIds: [network.id],
      deterministic: true,
    });
  }

  if (crossNode) {
    transformations.push({
      id: "transform_sentinel_cross_node_to_reality_observation",
      name: "Sentinel cross-node report → consistency observation",
      inputIds: [crossNode.id],
      outputIds: [crossNode.id],
      deterministic: true,
    });
  }

  transformations.push({
    id: "transform_sentinel_observations_to_verification",
    name: "Sentinel observations → configured verification predicates",
    inputIds: observations.map((observation) => observation.id),
    outputIds: verifications.map((verification) => verification.id),
    deterministic: true,
  });

  return sealRealityRecord(
    {
      schema: "rchain-reality-record/v1",
      id: `${stableEvidenceId(bundle)}:${bundle.collectedAt}`,
      subject: {
        id: bundle.evidence.block_hash ?? stableEvidenceId(bundle),
        kind: "sentinel-observation",
        label: "RChain finalized-block observation",
      },
      source: "rchain-sentinel",
      observations,
      claims,
      evidence,
      dependencies,
      transformations,
      verification: verifications,
      replay: {
        available: false,
        inputIds: observations.map((observation) => observation.id),
        state: "INCOMPLETE",
      },
    },
    previousDigest,
  );
}

export async function fetchSentinelBundle(
  sentinelBaseUrl: string,
  options: {
    fetchImpl?: typeof fetch;
    collectedAt?: string;
    includeNetworkStatus?: boolean;
    includeCrossNodeVerification?: boolean;
  } = {},
): Promise<SentinelObservationBundle> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = sentinelBaseUrl.replace(/\/+$/, "");
  const response = await fetchImpl(`${base}${SENTINEL_ENDPOINTS.finalizedBlockEvidence}`);
  if (!response.ok) {
    throw new Error(`Sentinel finalized-block endpoint returned HTTP ${response.status}`);
  }

  const evidence = (await response.json()) as SentinelFinalizedBlockEvidence;
  let network: SentinelNetworkStatus | undefined;
  let crossNode: SentinelCrossNodeReport | undefined;
  if (options.includeNetworkStatus) {
    const networkResponse = await fetchImpl(`${base}${SENTINEL_ENDPOINTS.networkStatus}`);
    if (!networkResponse.ok) {
      throw new Error(`Sentinel network-status endpoint returned HTTP ${networkResponse.status}`);
    }
    network = (await networkResponse.json()) as SentinelNetworkStatus;
  }
  if (options.includeCrossNodeVerification) {
    const crossNodeResponse = await fetchImpl(`${base}${SENTINEL_ENDPOINTS.crossNodeVerification}`);
    if (!crossNodeResponse.ok) {
      throw new Error(`Sentinel cross-node endpoint returned HTTP ${crossNodeResponse.status}`);
    }
    crossNode = (await crossNodeResponse.json()) as SentinelCrossNodeReport;
  }

  return {
    sentinelBaseUrl: base,
    collectedAt: options.collectedAt ?? new Date().toISOString(),
    evidence,
    ...(network ? { network } : {}),
    ...(crossNode ? { crossNode } : {}),
  };
}

export async function fetchSentinelRealityRecord(
  sentinelBaseUrl: string,
  options: Parameters<typeof fetchSentinelBundle>[1] = {},
): Promise<RealityRecord> {
  return sentinelBundleToRecord(await fetchSentinelBundle(sentinelBaseUrl, options));
}
