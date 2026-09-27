import {
  attestationPayloadDigest,
  attestationPublicKeyId,
  attestationSigningBytes,
  verifyPinnedEd25519Attestation,
  type PinnedEd25519Verification,
} from "./attestation-crypto.ts";

export const BUILD_PROVENANCE_ATTESTATION_SCHEMA =
  "rchain-build-provenance-attestation/v1" as const;
export const IN_TOTO_STATEMENT_V1 =
  "https://in-toto.io/Statement/v1" as const;
export const SLSA_PROVENANCE_V1 =
  "https://slsa.dev/provenance/v1" as const;

export interface SlsaResourceDescriptor {
  name?: string;
  uri?: string;
  digest?: Record<string, string>;
  [key: string]: unknown;
}

export interface SlsaBuildProvenanceStatement {
  _type: typeof IN_TOTO_STATEMENT_V1;
  subject: Array<{
    name: string;
    digest: Record<string, string>;
  }>;
  predicateType: typeof SLSA_PROVENANCE_V1;
  predicate: {
    buildDefinition: {
      buildType: string;
      externalParameters: Record<string, unknown>;
      internalParameters?: Record<string, unknown>;
      resolvedDependencies?: SlsaResourceDescriptor[];
    };
    runDetails: {
      builder: {
        id: string;
        version?: Record<string, string>;
        builderDependencies?: SlsaResourceDescriptor[];
      };
      metadata?: {
        invocationId?: string;
        startedOn?: string;
        finishedOn?: string;
      };
      byproducts?: SlsaResourceDescriptor[];
    };
  };
}

export interface BuildProvenanceAttestationPayload {
  schema: typeof BUILD_PROVENANCE_ATTESTATION_SCHEMA;
  release: {
    repository: string;
    commit: string;
    binary_sha256: string;
  };
  statement: SlsaBuildProvenanceStatement;
}

export interface SignedBuildProvenanceAttestation {
  schema: typeof BUILD_PROVENANCE_ATTESTATION_SCHEMA;
  payload: BuildProvenanceAttestationPayload;
  payload_sha256: string;
  signature: {
    algorithm: "Ed25519";
    key_id: string;
    public_key_hex: string;
    signature_hex: string;
  };
}

export interface BuildProvenanceAttestationVerification
  extends PinnedEd25519Verification {
  statementDigest: string | null;
  builderId: string | null;
  subjectName: string | null;
}

export interface VerifiedBuildProvenance {
  schema: typeof BUILD_PROVENANCE_ATTESTATION_SCHEMA;
  repository: string;
  commit: string;
  binaryDigest: string;
  statementDigest: string;
  payloadDigest: string;
  builderId: string;
  signerKeyId: string;
  subjectName: string;
}

const verifiedBuildProvenance = new WeakSet<VerifiedBuildProvenance>();

function isSha256(value: string): boolean {
  return /^sha256:[0-9a-f]{64}$/i.test(value);
}

function normalizeRepository(value: string): string {
  return value
    .trim()
    .replace(/^git\+/, "")
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/\.git(?:@.*)?$/i, "")
    .replace(/@refs\/.*$/i, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

function statementSubject(
  statement: SlsaBuildProvenanceStatement,
  binaryDigest: string,
): { name: string; digest: Record<string, string> } | null {
  const expected = binaryDigest.replace(/^sha256:/i, "").toLowerCase();
  return statement.subject.find(
    (subject) =>
      typeof subject.name === "string" &&
      typeof subject.digest?.sha256 === "string" &&
      subject.digest.sha256.toLowerCase() === expected,
  ) ?? null;
}

function dependencyMatchesRelease(
  dependency: SlsaResourceDescriptor,
  repository: string,
  commit: string,
): boolean {
  const digest = dependency.digest;
  const gitCommit =
    digest && typeof digest.gitCommit === "string"
      ? digest.gitCommit
      : null;
  if (!gitCommit || gitCommit.toLowerCase() !== commit.toLowerCase()) {
    return false;
  }

  if (typeof dependency.uri !== "string") return false;
  const normalizedUri = normalizeRepository(dependency.uri);
  const normalizedRepository = normalizeRepository(repository);
  return normalizedUri === normalizedRepository;
}

function validatePayload(
  payload: BuildProvenanceAttestationPayload,
): string | null {
  if (payload.schema !== BUILD_PROVENANCE_ATTESTATION_SCHEMA) {
    return "unexpected build provenance payload schema";
  }
  if (!payload.release.repository.trim()) {
    return "build provenance repository identity is missing";
  }
  if (!/^[0-9a-f]{40}$/i.test(payload.release.commit)) {
    return "build provenance commit must be a 40-hex Git commit";
  }
  if (!isSha256(payload.release.binary_sha256)) {
    return "build provenance binary_sha256 must be a sha256 fingerprint";
  }

  const statement = payload.statement;
  if (statement._type !== IN_TOTO_STATEMENT_V1) {
    return "build provenance statement is not in-toto Statement/v1";
  }
  if (statement.predicateType !== SLSA_PROVENANCE_V1) {
    return "build provenance predicateType is not SLSA provenance v1";
  }
  if (!Array.isArray(statement.subject) || statement.subject.length === 0) {
    return "build provenance statement has no subject";
  }
  if (!statementSubject(statement, payload.release.binary_sha256)) {
    return "build provenance subject does not bind the declared binary SHA-256";
  }

  const definition = statement.predicate?.buildDefinition;
  const runDetails = statement.predicate?.runDetails;
  if (!definition || !definition.buildType?.trim()) {
    return "build provenance buildType is missing";
  }
  if (
    !definition.externalParameters ||
    typeof definition.externalParameters !== "object" ||
    Array.isArray(definition.externalParameters)
  ) {
    return "build provenance externalParameters must be an object";
  }
  if (!runDetails?.builder?.id?.trim()) {
    return "build provenance builder.id is missing";
  }

  const dependencies = definition.resolvedDependencies ?? [];
  if (
    !dependencies.some((dependency) =>
      dependencyMatchesRelease(
        dependency,
        payload.release.repository,
        payload.release.commit,
      ),
    )
  ) {
    return "build provenance resolvedDependencies do not bind the declared repository and Git commit";
  }

  const externalRepository = definition.externalParameters.repository;
  if (
    typeof externalRepository === "string" &&
    normalizeRepository(externalRepository) !==
      normalizeRepository(payload.release.repository)
  ) {
    return "build provenance external repository parameter conflicts with the declared repository";
  }

  return null;
}

export function buildProvenanceAttestationSigningBytes(
  payload: BuildProvenanceAttestationPayload,
): Uint8Array {
  return attestationSigningBytes(BUILD_PROVENANCE_ATTESTATION_SCHEMA, payload);
}

export function buildProvenanceAttestationPayloadDigest(
  payload: BuildProvenanceAttestationPayload,
): Promise<string> {
  return attestationPayloadDigest(payload);
}

export function buildProvenanceStatementDigest(
  statement: SlsaBuildProvenanceStatement,
): Promise<string> {
  return attestationPayloadDigest(statement);
}

export function buildProvenanceAttestationPublicKeyId(
  publicKeyHex: string,
): Promise<string> {
  return attestationPublicKeyId(publicKeyHex);
}

export async function verifySignedBuildProvenanceAttestation(
  snapshot: SignedBuildProvenanceAttestation,
  expectedKeyId: string,
): Promise<BuildProvenanceAttestationVerification> {
  if (snapshot.schema !== BUILD_PROVENANCE_ATTESTATION_SCHEMA) {
    return {
      valid: false,
      keyId: null,
      reason: "unexpected build provenance envelope schema",
      payloadDigest: null,
      statementDigest: null,
      builderId: null,
      subjectName: null,
    };
  }

  const payloadError = validatePayload(snapshot.payload);
  if (payloadError) {
    return {
      valid: false,
      keyId: null,
      reason: payloadError,
      payloadDigest: null,
      statementDigest: null,
      builderId: null,
      subjectName: null,
    };
  }

  const result = await verifyPinnedEd25519Attestation({
    schema: BUILD_PROVENANCE_ATTESTATION_SCHEMA,
    payload: snapshot.payload,
    declaredPayloadDigest: snapshot.payload_sha256,
    algorithm: snapshot.signature.algorithm,
    declaredKeyId: snapshot.signature.key_id,
    publicKeyHex: snapshot.signature.public_key_hex,
    signatureHex: snapshot.signature.signature_hex,
    expectedKeyId,
  });

  const statementDigest = result.valid
    ? await buildProvenanceStatementDigest(snapshot.payload.statement)
    : null;
  const subject = result.valid
    ? statementSubject(
        snapshot.payload.statement,
        snapshot.payload.release.binary_sha256,
      )
    : null;

  return {
    ...result,
    reason: result.valid
      ? "Ed25519 build provenance signature, SLSA structure, source commit, and binary subject binding verified"
      : result.reason.replace("attestation signer", "build provenance signer"),
    statementDigest,
    builderId: result.valid
      ? snapshot.payload.statement.predicate.runDetails.builder.id
      : null,
    subjectName: subject?.name ?? null,
  };
}

export async function signedBuildProvenanceAttestationToVerified(args: {
  snapshot: SignedBuildProvenanceAttestation;
  expectedKeyId: string;
}): Promise<VerifiedBuildProvenance> {
  const verification = await verifySignedBuildProvenanceAttestation(
    args.snapshot,
    args.expectedKeyId,
  );
  if (
    !verification.valid ||
    !verification.keyId ||
    !verification.payloadDigest ||
    !verification.statementDigest ||
    !verification.builderId ||
    !verification.subjectName
  ) {
    throw new Error(
      `Build provenance attestation rejected: ${verification.reason}`,
    );
  }

  const verified: VerifiedBuildProvenance = Object.freeze({
    schema: BUILD_PROVENANCE_ATTESTATION_SCHEMA,
    repository: args.snapshot.payload.release.repository,
    commit: args.snapshot.payload.release.commit.toLowerCase(),
    binaryDigest: args.snapshot.payload.release.binary_sha256.toLowerCase(),
    statementDigest: verification.statementDigest.toLowerCase(),
    payloadDigest: verification.payloadDigest.toLowerCase(),
    builderId: verification.builderId,
    signerKeyId: verification.keyId.toLowerCase(),
    subjectName: verification.subjectName,
  });

  verifiedBuildProvenance.add(verified);
  return verified;
}

export function isCryptographicallyVerifiedBuildProvenance(
  value: VerifiedBuildProvenance,
): boolean {
  return verifiedBuildProvenance.has(value);
}
