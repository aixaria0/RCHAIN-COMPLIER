import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { repairCasperDuplicateMinimumSenderCoverage } from "../src/lib/cbc/casper-repair-adapter.ts";

interface NativeRepairReceipt {
  schema: "cbc-native-repair-replay/v1";
  upstreamRepository: string;
  upstreamCommit: string;
  repairAction: string;
  before: {
    justifications: string[];
    minimumMessageSenders: string[];
    fringe: string[];
    finalized: boolean;
  };
  after: {
    justifications: string[];
    minimumMessageSenders: string[];
    fringe: string[];
    finalized: boolean;
  };
}

function canonical(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  switch (typeof value) {
    case "string":
    case "boolean":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) throw new Error("non-finite receipt value");
      return Object.is(value, -0) ? "0" : String(value);
    case "object": {
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
    }
    default:
      throw new Error(`unsupported receipt value: ${typeof value}`);
  }
}

function sha256(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonical(value)).digest("hex")}`;
}

const receiptPath = process.argv[2];
if (!receiptPath) throw new Error("usage: verify-cbc-native-repair-receipt.ts <receipt.json>");

const receipt = JSON.parse(await readFile(receiptPath, "utf8")) as NativeRepairReceipt;
if (receipt.schema !== "cbc-native-repair-replay/v1") throw new Error("unexpected native repair receipt schema");
if (receipt.upstreamRepository !== "rchain-community/rchain-rust") throw new Error("unexpected upstream repository");
if (receipt.upstreamCommit !== "d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b") throw new Error("unexpected upstream commit");

const compiled = repairCasperDuplicateMinimumSenderCoverage();
if (compiled.status !== "COMPILED" || compiled.artifact?.outcome !== "REPAIR_FOUND") {
  throw new Error("CBC repair compiler did not produce REPAIR_FOUND");
}
const action = compiled.artifact.selectedActions[0]?.label;
if (!action || action !== receipt.repairAction) {
  throw new Error(`native receipt repair action ${receipt.repairAction} does not match compiler selection ${action ?? "NONE"}`);
}
function exactStrings(actual: string[], expected: readonly string[]): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

const expectedBefore = {
  justifications: ["a2", "a3", "b3", "c3"] as const,
  minimumMessageSenders: ["v0", "v0", "v1", "v2"] as const,
  fringe: ["a1", "b1", "c1"] as const,
  finalized: true,
};

const expectedAfter = {
  justifications: ["a3", "b3", "c3", "d3"] as const,
  minimumMessageSenders: ["v0", "v1", "v2", "v3"] as const,
  fringe: ["a1", "b1", "c1", "d1"] as const,
  finalized: true,
};

if (
  receipt.before.finalized !== expectedBefore.finalized ||
  receipt.after.finalized !== expectedAfter.finalized ||
  !exactStrings(receipt.before.justifications, expectedBefore.justifications) ||
  !exactStrings(
    receipt.before.minimumMessageSenders,
    expectedBefore.minimumMessageSenders,
  ) ||
  !exactStrings(receipt.before.fringe, expectedBefore.fringe) ||
  !exactStrings(receipt.after.justifications, expectedAfter.justifications) ||
  !exactStrings(
    receipt.after.minimumMessageSenders,
    expectedAfter.minimumMessageSenders,
  ) ||
  !exactStrings(receipt.after.fringe, expectedAfter.fringe)
) {
  throw new Error(
    "native receipt does not exactly match the pinned before/after Finalizer fixture",
  );
}

const binding = {
  schema: "cbc-native-repair-binding/v1",
  upstreamRepository: receipt.upstreamRepository,
  upstreamCommit: receipt.upstreamCommit,
  repairProblemId: compiled.artifact.repairProblemId,
  repairAction: action,
  repairArtifactDigest: sha256(compiled.artifact),
  nativeReceiptDigest: sha256(receipt),
  beforeStateDigest: sha256(receipt.before),
  afterStateDigest: sha256(receipt.after),
  nativeReplayVerified: true,
};

process.stdout.write(`${JSON.stringify(binding, null, 2)}\n`);
