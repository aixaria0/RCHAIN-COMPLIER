import { randomUUID } from "node:crypto";
import { AssuranceEngine } from "../assurance/engine.ts";
import { loadEngineIdentity } from "../assurance/runtime.ts";
import { policyDigest } from "../lattice/protocol.ts";
import { replay } from "../lattice/replay.ts";
import { createOmegaProof } from "./attestation.ts";
import type { OmegaProcessStatus, OmegaProof, OmegaStatus, OmegaTrust } from "./types.ts";

async function json(endpoint: string, path: string): Promise<Record<string, unknown>> {
  const response = await fetch(endpoint + path, {
    redirect: "error",
    credentials: "omit",
    signal: AbortSignal.timeout(2000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`${path} HTTP ${response.status}`);
  }
  const value: unknown = await response.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path} object required`);
  return value as Record<string, unknown>;
}

function actorFromCapability(value: Record<string, unknown>): string | null {
  return typeof value.actorId === "string" ? value.actorId : null;
}

export class OmegaNode {
  readonly engine: AssuranceEngine;
  readonly bootId: string;
  readonly nodeId: string;

  private constructor(engine: AssuranceEngine) {
    this.engine = engine;
    this.bootId = randomUUID();
    this.nodeId = `omega:${policyDigest(engine.state.policy).slice("sha256:".length, 32 + "sha256:".length)}`;
  }

  static async open(
    directory: string,
    options: { onDiagnostic?: (value: unknown) => void } = {},
  ): Promise<OmegaNode> {
    const engine = await AssuranceEngine.open(directory, {
      onDiagnostic: options.onDiagnostic ? (diagnostic) => options.onDiagnostic!(diagnostic) : undefined,
    });
    return new OmegaNode(engine);
  }

  trust(): OmegaTrust {
    const owner = this.engine.state.policy.members[0]!;
    return {
      schema: "omega-trust/v1",
      expectedNodeId: this.nodeId,
      expectedPolicyDigest: policyDigest(this.engine.state.policy),
      expectedOwnerActorId: owner.actorId,
      expectedOwnerPublicKeyHex: owner.publicKeyHex,
    };
  }

  async status(): Promise<OmegaStatus> {
    const policy = this.engine.state.policy;
    const reasons: string[] = [];
    const members: OmegaProcessStatus[] = [];
    let identityFailed = false;
    let replayValid = false;
    let eventRoot: string | null = null;
    let equivocations = 0;

    for (let index = 0; index < 3; index++) {
      const endpoint = this.engine.endpoints[index]!;
      const pid = this.engine.processIds[index]!;
      const expectedActorId = policy.members[index]!.actorId;
      let observedActorId: string | null = null;
      let healthy = false;
      let identityValid = false;
      let eventCount: number | null = null;
      try {
        const health = await json(endpoint, "/health");
        const identity = await json(endpoint, "/identity");
        observedActorId =
          typeof health.actorId === "string" ? health.actorId : actorFromCapability(identity);
        eventCount = Number.isSafeInteger(health.eventCount) ? (health.eventCount as number) : null;
        healthy = health.ready === true && observedActorId === expectedActorId;
        identityValid = actorFromCapability(identity) === expectedActorId;
        if (!healthy || !identityValid) {
          identityFailed = true;
          reasons.push(`process ${index} identity or health binding failed`);
        }
      } catch (cause) {
        reasons.push(`process ${index} unavailable: ${cause instanceof Error ? cause.message : "unknown error"}`);
      }
      members.push({
        index,
        pid,
        endpoint,
        expectedActorId,
        observedActorId,
        healthy,
        identityValid,
        eventCount,
      });
    }

    try {
      const events = await this.engine.events();
      const view = replay(events, policy, this.engine.registry);
      eventRoot = view.eventRoot;
      equivocations = view.equivocations.length;
      replayValid = true;
      if (equivocations) reasons.push(`${equivocations} equivocation(s) detected`);
    } catch (cause) {
      reasons.push(`independent replay failed: ${cause instanceof Error ? cause.message : "unknown error"}`);
    }

    const alive = members.filter((member) => member.healthy).length;
    const unique = new Set(this.engine.processIds).size;
    const verifiedWorkers = members.slice(1).filter((member) => member.healthy && member.identityValid).length;
    const ownerHealthy = members[0]?.healthy === true;
    const compromised = identityFailed || equivocations > 0 || (ownerHealthy && !replayValid);
    const online =
      !compromised &&
      alive === 3 &&
      unique === 3 &&
      verifiedWorkers === 2 &&
      replayValid &&
      eventRoot !== null;
    const state = compromised ? "COMPROMISED" : online ? "ONLINE" : "DEGRADED";
    if (state === "DEGRADED" && !reasons.length) reasons.push("one or more online invariants are unsatisfied");

    return {
      schema: "omega-status/v1",
      state,
      nodeId: this.nodeId,
      bootId: this.bootId,
      checkedAt: new Date().toISOString(),
      policyDigest: policyDigest(policy),
      eventRoot,
      processes: { expected: 3, alive, unique, members },
      workers: { required: 2, verified: verifiedWorkers },
      identity: identityFailed ? "FAIL" : "PASS",
      replay: replayValid ? "PASS" : "FAIL",
      registry: "PASS",
      equivocations,
      reasons,
    };
  }

  async prove(ttlMs = 30_000): Promise<OmegaProof> {
    const status = await this.status();
    if (!status.eventRoot) throw new Error("Cannot attest Omega state without a replay event root");
    const identity = loadEngineIdentity(this.engine.directory, 0);
    return createOmegaProof(status, identity, ttlMs);
  }

  close(): Promise<void> {
    return this.engine.close();
  }
}
