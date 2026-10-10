import { createHash } from "node:crypto";

const PREFIX = Buffer.from("CHIMERA-CXP\0run/v2\0", "utf8");

function canonical(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("unsupported number");
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    if (keys.some((key) => !/^[\x20-\x7e]+$/.test(key))) throw new Error("non-ASCII object key");
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  throw new Error("unsupported value");
}

export function digestCxpRun(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("CXP run must be an object");
  const body = { ...input };
  delete body.cxp_sha256;
  return createHash("sha256").update(PREFIX).update(Buffer.from(canonical(body), "utf8")).digest("hex");
}

function verifyQuantumCxp(claim, evidence) {
  const run = evidence?.[0]?.body?.artifact?.content;
  let computed = null;
  const checks = {
    boundedInput: false,
    schema: false,
    digest: false,
    policy: false,
    claimsRemainHypotheses: false,
    assuredProviderCertificate: false,
    twoProcessQuorum: false,
    replay: false,
    qpuNotPromoted: false,
    externalTruthNotPromoted: false,
    consensusNotPromoted: false,
  };

  try {
    const encoded = Buffer.from(canonical(run), "utf8");
    checks.boundedInput = encoded.length <= 16 * 1024;
    checks.schema = run?.schema === "chimera-run/v2" && run?.cxp_version === 1;
    computed = digestCxpRun(run);
    checks.digest = run?.cxp_sha256 === computed;
    checks.policy =
      run?.policy?.unrestricted_execution === false &&
      run?.policy?.claim_promotion_requires_evidence === true &&
      run?.policy?.replay_required === true &&
      run?.policy?.quorum_required === 2;
    checks.claimsRemainHypotheses =
      Array.isArray(run?.claims) && run.claims.length > 0 && run.claims.every((entry) => entry?.status === "HYPOTHESIS");
    checks.assuredProviderCertificate =
      run?.certificate?.status === "ASSURED" &&
      typeof run?.certificate?.provider_certificate_sha256 === "string" &&
      /^[0-9a-f]{64}$/.test(run.certificate.provider_certificate_sha256);
    checks.twoProcessQuorum = run?.authority?.two_process_quorum === "CONFIRMED";
    checks.replay = run?.verification?.replay === "CONFIRMED";
    checks.qpuNotPromoted = run?.authority?.qpu_execution === "UNKNOWN" && run?.verification?.qpu_execution === "UNKNOWN";
    checks.externalTruthNotPromoted = run?.authority?.external_truth === "UNKNOWN" && run?.verification?.external_truth === "UNKNOWN";
    checks.consensusNotPromoted = run?.consensus?.status === "NOT_RUN" && run?.consensus?.finality === "UNKNOWN";
  } catch {
    // Deterministic malformed-input refutation. The assurance engine owns report semantics.
  }

  const actual = Object.values(checks).every(Boolean);
  const asserted = claim?.body?.value;
  return {
    verdict: asserted === actual ? "SUPPORTED" : "REFUTED",
    artifact: {
      schema: "quantum-cxp-verifier-result/v1",
      actual,
      computedCxpSha256: computed,
      declaredCxpSha256: typeof run?.cxp_sha256 === "string" ? run.cxp_sha256 : null,
      checks,
      scope: "DETACHED_CXP_CONTRACT_REPRODUCTION_ONLY",
      limitations: [
        "This verifier does not execute the quantum workload.",
        "This verifier does not establish QPU execution, independent hosts, hardware attestation, or external truth.",
      ],
    },
  };
}

export const VERIFIERS = new Map([["quantum-cxp/v1", verifyQuantumCxp]]);
