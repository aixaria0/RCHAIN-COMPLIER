/**
 * Node-only producer for promotion-grade Assurance Fabric attestations.
 *
 * This module intentionally owns private-key handling outside the browser/UI
 * bundle. It never generates or persists keys. Callers must provide a 32-byte
 * Ed25519 seed from an external secret store or protected file.
 */
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  type KeyObject,
} from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  BUILD_PROVENANCE_ATTESTATION_SCHEMA,
  IN_TOTO_STATEMENT_V1,
  SLSA_PROVENANCE_V1,
  type SignedBuildProvenanceAttestation,
  type SlsaBuildProvenanceStatement,
} from "./build-provenance-signed-adapter.ts";
import {
  NATIVE_REPLAY_ATTESTATION_SCHEMA,
  type NativeReplayAttestationPayload,
  type SignedNativeReplayAttestation,
} from "./native-replay-signed-adapter.ts";

const ED25519_PKCS8_SEED_PREFIX = Buffer.from(
  "302e020100300506032b657004220420",
  "hex",
);
const ED25519_SPKI_PREFIX = Buffer.from(
  "302a300506032b6570032100",
  "hex",
);

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(canonicalize(value)), "utf8");
}

function sha256Bytes(value: Uint8Array): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function signingBytes(schema: string, payload: unknown): Buffer {
  return Buffer.concat([
    Buffer.from(`${schema}\n`, "utf8"),
    canonicalBytes(payload),
  ]);
}

function privateKeyFromSeed(seedHex: string): KeyObject {
  if (!/^[0-9a-f]{64}$/i.test(seedHex)) {
    throw new Error("Ed25519 private seed must be exactly 32 bytes encoded as 64 hexadecimal characters");
  }
  const seed = Buffer.from(seedHex, "hex");
  const key = createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_SEED_PREFIX, seed]),
    format: "der",
    type: "pkcs8",
  });
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error("private seed did not produce an Ed25519 key");
  }
  return key;
}

function rawPublicKey(privateKey: KeyObject): Buffer {
  const der = createPublicKey(privateKey).export({
    format: "der",
    type: "spki",
  }) as Buffer;
  if (
    der.length !== ED25519_SPKI_PREFIX.length + 32 ||
    !der.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
  ) {
    throw new Error("unexpected Ed25519 SubjectPublicKeyInfo encoding");
  }
  return der.subarray(ED25519_SPKI_PREFIX.length);
}

function signEnvelope<T extends object>(args: {
  schema: string;
  payload: T;
  privateSeedHex: string;
}): {
  payload_sha256: string;
  signature: {
    algorithm: "Ed25519";
    key_id: string;
    public_key_hex: string;
    signature_hex: string;
  };
} {
  const privateKey = privateKeyFromSeed(args.privateSeedHex);
  const publicKey = rawPublicKey(privateKey);
  const payloadDigest = sha256Bytes(canonicalBytes(args.payload));
  const signature = cryptoSign(
    null,
    signingBytes(args.schema, args.payload),
    privateKey,
  );

  return {
    payload_sha256: payloadDigest,
    signature: {
      algorithm: "Ed25519",
      key_id: sha256Bytes(publicKey),
      public_key_hex: publicKey.toString("hex"),
      signature_hex: signature.toString("hex"),
    },
  };
}

function requireCommit(commit: string): string {
  if (!/^[0-9a-f]{40}$/i.test(commit)) {
    throw new Error("commit must be a 40-hex Git commit");
  }
  return commit.toLowerCase();
}

function requireRepository(repository: string): string {
  const value = repository.trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) {
    throw new Error("repository must use owner/name form");
  }
  return value;
}

export async function sha256File(path: string): Promise<string> {
  return sha256Bytes(await readFile(path));
}

export async function createSignedBuildProvenanceAttestation(args: {
  repository: string;
  commit: string;
  artifactPath: string;
  subjectName?: string;
  builderId: string;
  buildType?: string;
  invocationId?: string;
  startedOn?: string;
  finishedOn?: string;
  privateSeedHex: string;
}): Promise<SignedBuildProvenanceAttestation> {
  const repository = requireRepository(args.repository);
  const commit = requireCommit(args.commit);
  const builderId = args.builderId.trim();
  if (!builderId) throw new Error("builderId is required");

  const binaryDigest = await sha256File(args.artifactPath);
  const subjectName =
    args.subjectName?.trim() ||
    args.artifactPath.split(/[\\/]/).filter(Boolean).at(-1) ||
    "rchain-assurance-artifact";
  const buildType =
    args.buildType?.trim() ||
    `https://github.com/${repository}/.github/workflows/assurance-provenance.yml@v1`;

  const statement: SlsaBuildProvenanceStatement = {
    _type: IN_TOTO_STATEMENT_V1,
    subject: [
      {
        name: subjectName,
        digest: {
          sha256: binaryDigest.slice("sha256:".length),
        },
      },
    ],
    predicateType: SLSA_PROVENANCE_V1,
    predicate: {
      buildDefinition: {
        buildType,
        externalParameters: {
          repository,
          commit,
        },
        resolvedDependencies: [
          {
            uri: `https://github.com/${repository}.git`,
            digest: {
              gitCommit: commit,
            },
          },
        ],
      },
      runDetails: {
        builder: {
          id: builderId,
        },
        ...(args.invocationId || args.startedOn || args.finishedOn
          ? {
              metadata: {
                ...(args.invocationId ? { invocationId: args.invocationId } : {}),
                ...(args.startedOn ? { startedOn: args.startedOn } : {}),
                ...(args.finishedOn ? { finishedOn: args.finishedOn } : {}),
              },
            }
          : {}),
      },
    },
  };

  const payload = {
    schema: BUILD_PROVENANCE_ATTESTATION_SCHEMA,
    release: {
      repository,
      commit,
      binary_sha256: binaryDigest,
    },
    statement,
  } as const;

  const signed = signEnvelope({
    schema: BUILD_PROVENANCE_ATTESTATION_SCHEMA,
    payload,
    privateSeedHex: args.privateSeedHex,
  });

  return {
    schema: BUILD_PROVENANCE_ATTESTATION_SCHEMA,
    payload,
    ...signed,
  };
}

export function createSignedNativeReplayAttestation(args: {
  payload: NativeReplayAttestationPayload;
  privateSeedHex: string;
}): SignedNativeReplayAttestation {
  if (args.payload.schema !== NATIVE_REPLAY_ATTESTATION_SCHEMA) {
    throw new Error("native replay payload has the wrong schema");
  }

  const signed = signEnvelope({
    schema: NATIVE_REPLAY_ATTESTATION_SCHEMA,
    payload: args.payload,
    privateSeedHex: args.privateSeedHex,
  });

  return {
    schema: NATIVE_REPLAY_ATTESTATION_SCHEMA,
    payload: args.payload,
    ...signed,
  };
}
