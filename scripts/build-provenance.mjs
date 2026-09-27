import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  verify as cryptoVerify,
} from "node:crypto";
import { basename } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

export const BUILD_PROVENANCE_ATTESTATION_SCHEMA =
  "rchain-build-provenance-attestation/v1";
export const IN_TOTO_STATEMENT_V1 = "https://in-toto.io/Statement/v1";
export const SLSA_PROVENANCE_V1 = "https://slsa.dev/provenance/v1";

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256Buffer(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function sha256File(path) {
  return sha256Buffer(await readFile(path));
}

function signingKeyFromSeedHex(seedHex) {
  if (!/^[0-9a-f]{64}$/i.test(seedHex ?? "")) {
    throw new Error("Ed25519 secret seed must contain exactly 32 bytes of hex");
  }
  const pkcs8Prefix = Buffer.from("302e020100300506032b657004220420", "hex");
  return createPrivateKey({
    key: Buffer.concat([pkcs8Prefix, Buffer.from(seedHex, "hex")]),
    format: "der",
    type: "pkcs8",
  });
}

function rawPublicKey(key) {
  const publicKey = createPublicKey(key);
  if (publicKey.asymmetricKeyType !== "ed25519") {
    throw new Error("build provenance signing key must be Ed25519");
  }
  const jwk = publicKey.export({ format: "jwk" });
  if (!jwk.x) throw new Error("Ed25519 public key JWK did not contain x");
  return Buffer.from(jwk.x, "base64url");
}

export async function buildProvenancePayload({
  repository,
  commit,
  binaryPath,
  builderId,
  invocationId,
  startedOn,
  finishedOn,
}) {
  if (!repository?.trim()) throw new Error("repository is required");
  if (!/^[0-9a-f]{40}$/i.test(commit ?? "")) {
    throw new Error("commit must be a 40-hex Git commit");
  }
  if (!builderId?.trim()) throw new Error("builderId is required");

  const digestHex = await sha256File(binaryPath);
  const binaryDigest = `sha256:${digestHex}`;
  const repositoryUrl = repository.startsWith("http")
    ? repository
    : `https://github.com/${repository}`;

  return {
    schema: BUILD_PROVENANCE_ATTESTATION_SCHEMA,
    release: {
      repository,
      commit: commit.toLowerCase(),
      binary_sha256: binaryDigest,
    },
    statement: {
      _type: IN_TOTO_STATEMENT_V1,
      subject: [
        {
          name: basename(binaryPath),
          digest: { sha256: digestHex },
        },
      ],
      predicateType: SLSA_PROVENANCE_V1,
      predicate: {
        buildDefinition: {
          buildType: "https://github.com/actions/workflow/v1",
          externalParameters: {
            repository: repositoryUrl,
            commit: commit.toLowerCase(),
          },
          resolvedDependencies: [
            {
              uri: repositoryUrl,
              digest: { gitCommit: commit.toLowerCase() },
            },
          ],
        },
        runDetails: {
          builder: { id: builderId },
          metadata: {
            ...(invocationId ? { invocationId } : {}),
            ...(startedOn ? { startedOn } : {}),
            ...(finishedOn ? { finishedOn } : {}),
          },
        },
      },
    },
  };
}

export function signBuildProvenancePayload(payload, seedHex) {
  const key = signingKeyFromSeedHex(seedHex);
  const publicKey = rawPublicKey(key);
  const canonicalPayload = Buffer.from(canonicalJson(payload), "utf8");
  const payloadDigest = `sha256:${sha256Buffer(canonicalPayload)}`;
  const signingBytes = Buffer.concat([
    Buffer.from(`${BUILD_PROVENANCE_ATTESTATION_SCHEMA}\n`, "utf8"),
    canonicalPayload,
  ]);
  const signature = cryptoSign(null, signingBytes, key);
  const keyId = `sha256:${sha256Buffer(publicKey)}`;

  return {
    schema: BUILD_PROVENANCE_ATTESTATION_SCHEMA,
    payload,
    payload_sha256: payloadDigest,
    signature: {
      algorithm: "Ed25519",
      key_id: keyId,
      public_key_hex: publicKey.toString("hex"),
      signature_hex: signature.toString("hex"),
    },
  };
}

export function verifyBuildProvenanceEnvelope(envelope) {
  try {
    if (envelope?.schema !== BUILD_PROVENANCE_ATTESTATION_SCHEMA) return false;
    const publicRaw = Buffer.from(envelope.signature.public_key_hex, "hex");
    if (publicRaw.length !== 32) return false;
    const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
    const publicKey = createPublicKey({
      key: Buffer.concat([spkiPrefix, publicRaw]),
      format: "der",
      type: "spki",
    });
    const canonicalPayload = Buffer.from(canonicalJson(envelope.payload), "utf8");
    const expectedPayloadDigest = `sha256:${sha256Buffer(canonicalPayload)}`;
    if (expectedPayloadDigest !== envelope.payload_sha256) return false;
    const expectedKeyId = `sha256:${sha256Buffer(publicRaw)}`;
    if (expectedKeyId !== envelope.signature.key_id) return false;
    const signingBytes = Buffer.concat([
      Buffer.from(`${BUILD_PROVENANCE_ATTESTATION_SCHEMA}\n`, "utf8"),
      canonicalPayload,
    ]);
    return cryptoVerify(
      null,
      signingBytes,
      publicKey,
      Buffer.from(envelope.signature.signature_hex, "hex"),
    );
  } catch {
    return false;
  }
}

async function main() {
  const binaryPath = process.env.ASSURANCE_BINARY_PATH;
  const repository = process.env.ASSURANCE_REPOSITORY ?? process.env.GITHUB_REPOSITORY;
  const commit = process.env.ASSURANCE_COMMIT ?? process.env.GITHUB_SHA;
  const builderId =
    process.env.ASSURANCE_BUILDER_ID ??
    (process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : undefined);
  const invocationId =
    process.env.ASSURANCE_INVOCATION_ID ?? process.env.GITHUB_RUN_ID;
  const outputDir = process.env.ASSURANCE_OUTPUT_DIR ?? "assurance-out";

  if (!binaryPath) throw new Error("ASSURANCE_BINARY_PATH is required");
  if (!repository) throw new Error("ASSURANCE_REPOSITORY/GITHUB_REPOSITORY is required");
  if (!commit) throw new Error("ASSURANCE_COMMIT/GITHUB_SHA is required");

  const now = new Date().toISOString();
  const payload = await buildProvenancePayload({
    repository,
    commit,
    binaryPath,
    builderId,
    invocationId,
    startedOn: process.env.ASSURANCE_STARTED_ON ?? now,
    finishedOn: process.env.ASSURANCE_FINISHED_ON ?? now,
  });

  await mkdir(outputDir, { recursive: true });
  await writeFile(
    `${outputDir}/build-provenance-payload.json`,
    `${JSON.stringify(payload, null, 2)}\n`,
  );

  const seedHex = process.env.ASSURANCE_BUILDER_ED25519_SECRET_HEX;
  if (seedHex) {
    const envelope = signBuildProvenancePayload(payload, seedHex);
    if (!verifyBuildProvenanceEnvelope(envelope)) {
      throw new Error("self-verification of build provenance envelope failed");
    }
    await writeFile(
      `${outputDir}/build-provenance-attestation.json`,
      `${JSON.stringify(envelope, null, 2)}\n`,
    );
    process.stdout.write(
      JSON.stringify({
        signed: true,
        binary_sha256: payload.release.binary_sha256,
        key_id: envelope.signature.key_id,
        payload_sha256: envelope.payload_sha256,
      }) + "\n",
    );
  } else {
    process.stdout.write(
      JSON.stringify({
        signed: false,
        binary_sha256: payload.release.binary_sha256,
        reason: "ASSURANCE_BUILDER_ED25519_SECRET_HEX not configured",
      }) + "\n",
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
