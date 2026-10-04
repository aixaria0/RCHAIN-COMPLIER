#!/usr/bin/env node
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeEngine } from "../assurance/engine.ts";
import { readBounded } from "../assurance/runtime.ts";
import { canonical, policyDigest } from "../lattice/protocol.ts";
import { OmegaNode } from "./node.ts";
import { startOmegaService } from "./service.ts";
import { verifyOmegaProof } from "./attestation.ts";
import type { OmegaProof, OmegaTrust } from "./types.ts";

const HELP = `Omega Node v0.1
Usage:
  omega init DIRECTORY TRUST.json
  omega start DIRECTORY [PORT]
  omega status SERVICE_URL
  omega prove SERVICE_URL TRUST.json
  omega inspect DIRECTORY
  omega recover DIRECTORY

Omega is loopback-only in v0.1. ONLINE means the live three-process assurance engine,
identity bindings, two-worker quorum, replay root and equivocation checks all pass.
`;

function output(value: unknown) {
  process.stdout.write(JSON.stringify(value) + "\n");
}

function atomicWrite(file: string, content: string) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, content, { mode: 0o600, flag: "wx" });
  renameSync(temporary, file);
}

function serviceUrl(raw: string): URL {
  const url = new URL(raw);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    !url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Omega v0.1 requires an http://127.0.0.1:PORT service URL");
  return url;
}

async function getJson<T>(base: string, path: string): Promise<T> {
  const target = new URL(path, serviceUrl(base));
  const response = await fetch(target, {
    redirect: "error",
    credentials: "omit",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`${path} HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

function readTrust(file: string): OmegaTrust {
  const value = JSON.parse(readBounded(file, 16384).toString("utf8")) as OmegaTrust;
  if (
    value.schema !== "omega-trust/v1" ||
    typeof value.expectedNodeId !== "string" ||
    typeof value.expectedPolicyDigest !== "string" ||
    typeof value.expectedOwnerActorId !== "string" ||
    !/^[0-9a-f]{64}$/.test(value.expectedOwnerPublicKeyHex)
  )
    throw new Error("invalid Omega trust file");
  return value;
}

export async function main(args: string[]): Promise<number> {
  const [command, ...rest] = args;
  if (!command || ["help", "--help", "-h"].includes(command)) {
    process.stdout.write(HELP);
    return 0;
  }
  if (command === "--version") {
    output({ product: "Omega Node", version: "0.1.0" });
    return 0;
  }
  if (command === "init" && rest.length === 2) {
    const directory = resolve(rest[0]!);
    const trustFile = resolve(rest[1]!);
    if (trustFile === directory || trustFile.startsWith(directory + sep))
      throw new Error("retain Omega trust pins outside the node workspace");
    if (existsSync(trustFile)) throw new Error("trust file already exists");
    const state = initializeEngine(directory);
    const digest = policyDigest(state.policy);
    const owner = state.policy.members[0]!;
    const trust: OmegaTrust = {
      schema: "omega-trust/v1",
      expectedNodeId: `omega:${digest.slice("sha256:".length, 32 + "sha256:".length)}`,
      expectedPolicyDigest: digest,
      expectedOwnerActorId: owner.actorId,
      expectedOwnerPublicKeyHex: owner.publicKeyHex,
    };
    atomicWrite(trustFile, canonical(trust) + "\n");
    output({ schema: "omega-init/v1", directory, trustFile, trust });
    return 0;
  }
  if (command === "start" && (rest.length === 1 || rest.length === 2)) {
    const port = rest[1] === undefined ? 0 : Number(rest[1]);
    const node = await OmegaNode.open(resolve(rest[0]!));
    const service = await startOmegaService(node, port);
    try {
      output({ schema: "omega-service/v1", url: service.url, status: await node.status() });
      await new Promise<void>((resolveSignal) => {
        process.once("SIGINT", resolveSignal);
        process.once("SIGTERM", resolveSignal);
      });
    } finally {
      await service.close();
      await node.close();
    }
    return 0;
  }
  if (command === "status" && rest.length === 1) {
    const status = await getJson<{ state?: string }>(rest[0]!, "/omega/status");
    output(status);
    return status.state === "ONLINE" ? 0 : 1;
  }
  if (command === "prove" && rest.length === 2) {
    const proof = await getJson<OmegaProof>(rest[0]!, "/omega/proof");
    const report = verifyOmegaProof(proof, readTrust(rest[1]!));
    output(report);
    return report.status === "PASS" ? 0 : 1;
  }
  if (command === "inspect" && rest.length === 1) {
    const node = await OmegaNode.open(resolve(rest[0]!));
    try {
      const status = await node.status();
      output(status);
      return status.state === "ONLINE" ? 0 : 1;
    } finally {
      await node.close();
    }
  }
  if (command === "recover" && rest.length === 1) {
    const node = await OmegaNode.open(resolve(rest[0]!));
    try {
      await node.engine.recover();
      const status = await node.status();
      output({ schema: "omega-recovery/v1", status });
      return status.state === "ONLINE" ? 0 : 1;
    } finally {
      await node.close();
    }
  }
  throw new Error("invalid Omega arguments; use omega --help");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (cause) {
    output({
      schema: "omega-error/v1",
      status: "FAIL",
      reason: cause instanceof Error ? cause.message : "Omega operation failed",
    });
    process.exitCode = 2;
  }
}
