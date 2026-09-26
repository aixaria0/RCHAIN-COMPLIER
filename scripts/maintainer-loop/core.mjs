import { createHash } from "node:crypto";

function getPath(value, path) {
  return path.split(".").reduce((current, key) => {
    if (current === null || current === undefined) return undefined;
    return current[key];
  }, value);
}

function evaluateCheck(check, observations) {
  const actual = getPath(observations, check.path);
  if (actual === undefined || actual === null) {
    return {
      id: check.id,
      predicate: check.label,
      state: "INCOMPLETE",
      message: `missing observation at ${check.path}`,
      actual,
    };
  }

  let pass = false;
  switch (check.op) {
    case "equals":
      pass = actual === check.expected;
      break;
    case "truthy":
      pass = Boolean(actual);
      break;
    case "contains":
      pass = Array.isArray(actual)
        ? actual.includes(check.expected)
        : typeof actual === "string"
          ? actual.includes(String(check.expected))
          : actual && typeof actual === "object"
            ? Object.prototype.hasOwnProperty.call(actual, check.expected)
            : false;
      break;
    case "gt":
      pass = typeof actual === "number" && actual > check.expected;
      break;
    case "gte":
      pass = typeof actual === "number" && actual >= check.expected;
      break;
    default:
      throw new Error(`unsupported check op: ${check.op}`);
  }

  return {
    id: check.id,
    predicate: check.label,
    state: pass ? "VERIFIED" : "DIVERGENT",
    message: pass
      ? `verified: ${check.label}`
      : `divergence: ${check.label}; expected ${JSON.stringify(check.expected)}, observed ${JSON.stringify(actual)}`,
    actual,
  };
}

function deriveState(verification, replay) {
  if (verification.some((v) => v.state === "DIVERGENT") || replay.state === "DIVERGENT") return "DIVERGENT";
  if (verification.some((v) => v.state === "INCOMPLETE") || replay.state === "INCOMPLETE") return "INCOMPLETE";
  if (replay.available && replay.state === "REPRODUCED") return "REPRODUCED";
  if (verification.length && verification.every((v) => v.state === "VERIFIED")) return "VERIFIED";
  return verification.length ? "CONSISTENT" : "OBSERVED";
}

function canonicalPayload(record) {
  return JSON.stringify({
    schema: record.schema,
    id: record.id,
    subject: record.subject,
    source: record.source,
    observations: record.observations,
    claims: record.claims,
    evidence: record.evidence,
    dependencies: record.dependencies,
    transformations: record.transformations,
    verification: record.verification,
    replay: record.replay,
    state: record.state,
  });
}

function seal(record, previousDigest) {
  const recordDigest = createHash("sha256").update(canonicalPayload(record)).digest("hex");
  return {
    ...record,
    integrity: {
      recordDigest,
      ...(previousDigest ? { previousDigest } : {}),
      algorithm: "SHA-256",
    },
  };
}

export function verifyIntegrity(record) {
  const { integrity, ...payload } = record;
  const expected = createHash("sha256").update(canonicalPayload(payload)).digest("hex");
  return expected === integrity.recordDigest;
}

export function runScenario({ scenario, input, previousDigest }) {
  const timestamp = input.observedAt ?? new Date(0).toISOString();
  const source = input.source?.url ?? input.source?.repository ?? "maintainer-loop";
  const observation = {
    id: `obs:${scenario.id}`,
    source,
    type: "maintainer-loop-input",
    timestamp,
    data: input.observations ?? {},
  };

  const rawVerification = scenario.checks.map((check) =>
    evaluateCheck(check, input.observations ?? {}),
  );

  const evidence = rawVerification.map((result) => ({
    id: `evidence:${result.id}`,
    observationIds: [observation.id],
    description: result.message,
  }));

  const verification = rawVerification.map((result) => ({
    id: `verify:${result.id}`,
    predicate: result.predicate,
    state: result.state,
    message: result.message,
    evidenceIds: [`evidence:${result.id}`],
  }));

  const replayObservation = input.observations?.replay;
  const replay = {
    available: Boolean(scenario.replay),
    inputIds: [observation.id],
    ...(replayObservation?.expectedDigest ? { expectedDigest: replayObservation.expectedDigest } : {}),
    ...(replayObservation?.observedDigest ? { observedDigest: replayObservation.observedDigest } : {}),
    state: !scenario.replay
      ? "INCOMPLETE"
      : replayObservation?.matched === true
        ? "REPRODUCED"
        : replayObservation?.matched === false
          ? "DIVERGENT"
          : "INCOMPLETE",
  };

  const state = deriveState(verification, replay);
  const claims = scenario.checks.map((check) => ({
    id: `claim:${check.id}`,
    statement: check.label,
    basis: [`evidence:${check.id}`],
  }));

  const firstDivergence =
    verification.find((v) => v.state === "DIVERGENT") ??
    verification.find((v) => v.state === "INCOMPLETE") ??
    null;

  const record = seal(
    {
      schema: "rchain-reality-record/v1",
      id: `maintainer-loop:${scenario.id}:${input.subject?.id ?? "unknown"}`,
      subject: {
        id: input.subject?.id ?? scenario.id,
        kind: "maintainer-scenario",
        label: input.subject?.label ?? scenario.label,
      },
      source,
      observations: [observation],
      claims,
      evidence,
      dependencies: scenario.dependencies ?? [],
      transformations: [
        {
          id: `transform:${scenario.id}`,
          name: "maintainer-loop deterministic evaluation",
          inputIds: [observation.id],
          outputIds: verification.map((v) => v.id),
          deterministic: true,
        },
      ],
      verification,
      replay,
      state,
    },
    previousDigest,
  );

  return {
    scenario: scenario.id,
    state,
    firstDivergence,
    record,
  };
}
