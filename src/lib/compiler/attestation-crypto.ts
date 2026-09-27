export interface PinnedEd25519Verification {
  valid: boolean;
  keyId: string | null;
  reason: string;
  payloadDigest: string | null;
}

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

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(value.byteLength);
  new Uint8Array(buffer).set(value);
  return buffer;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

export function attestationHexToBytes(value: string): Uint8Array {
  if (value.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(value)) {
    throw new Error("invalid hexadecimal input");
  }
  const output = new Uint8Array(value.length / 2);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return output;
}

export function attestationBytesToHex(
  value: ArrayBuffer | Uint8Array,
): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function canonicalAttestationPayloadBytes(payload: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(canonicalize(payload)));
}

export function attestationSigningBytes(
  schema: string,
  payload: unknown,
): Uint8Array {
  return concatBytes(
    new TextEncoder().encode(`${schema}\n`),
    canonicalAttestationPayloadBytes(payload),
  );
}

async function sha256(value: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    toArrayBuffer(value),
  );
  return `sha256:${attestationBytesToHex(digest)}`;
}

export async function attestationPayloadDigest(payload: unknown): Promise<string> {
  return sha256(canonicalAttestationPayloadBytes(payload));
}

export async function attestationPublicKeyId(
  publicKeyHex: string,
): Promise<string> {
  const publicKey = attestationHexToBytes(publicKeyHex);
  if (publicKey.length !== 32) {
    throw new Error("Ed25519 public key must contain exactly 32 bytes");
  }
  return sha256(publicKey);
}

export async function verifyPinnedEd25519Attestation(args: {
  schema: string;
  payload: unknown;
  declaredPayloadDigest: string;
  algorithm: string;
  declaredKeyId: string;
  publicKeyHex: string;
  signatureHex: string;
  expectedKeyId: string;
}): Promise<PinnedEd25519Verification> {
  try {
    if (args.algorithm !== "Ed25519") {
      return {
        valid: false,
        keyId: null,
        reason: "unexpected signature algorithm",
        payloadDigest: null,
      };
    }
    if (!/^sha256:[0-9a-f]{64}$/i.test(args.expectedKeyId)) {
      return {
        valid: false,
        keyId: null,
        reason: "expected key id is not a sha256 fingerprint",
        payloadDigest: null,
      };
    }

    const publicKey = attestationHexToBytes(args.publicKeyHex);
    const signature = attestationHexToBytes(args.signatureHex);
    if (publicKey.length !== 32 || signature.length !== 64) {
      return {
        valid: false,
        keyId: null,
        reason: "invalid Ed25519 public-key or signature length",
        payloadDigest: null,
      };
    }

    const keyId = await sha256(publicKey);
    if (keyId.toLowerCase() !== args.declaredKeyId.toLowerCase()) {
      return {
        valid: false,
        keyId,
        reason: "public key fingerprint does not match envelope key_id",
        payloadDigest: null,
      };
    }
    if (keyId.toLowerCase() !== args.expectedKeyId.toLowerCase()) {
      return {
        valid: false,
        keyId,
        reason: "attestation signer key id is not the pinned expected key",
        payloadDigest: null,
      };
    }

    const payloadDigest = await attestationPayloadDigest(args.payload);
    if (payloadDigest.toLowerCase() !== args.declaredPayloadDigest.toLowerCase()) {
      return {
        valid: false,
        keyId,
        reason: "canonical payload digest mismatch",
        payloadDigest,
      };
    }

    const cryptoKey = await globalThis.crypto.subtle.importKey(
      "raw",
      toArrayBuffer(publicKey),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const valid = await globalThis.crypto.subtle.verify(
      { name: "Ed25519" },
      cryptoKey,
      toArrayBuffer(signature),
      toArrayBuffer(attestationSigningBytes(args.schema, args.payload)),
    );
    return {
      valid,
      keyId,
      reason: valid
        ? "Ed25519 signature and pinned key id verified"
        : "Ed25519 signature verification failed",
      payloadDigest,
    };
  } catch (error) {
    return {
      valid: false,
      keyId: null,
      reason: error instanceof Error ? error.message : "attestation verification failed",
      payloadDigest: null,
    };
  }
}
