import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  verify as cryptoVerify,
} from "node:crypto";

export const ASSURANCE_SIGNATURE_SCHEMA = "rchain-assurance-signature/v1";

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

function canonicalCertificateBytes(certificate) {
  if (!certificate || certificate.schema !== "rchain-assurance-certificate/v1") {
    throw new Error("expected rchain-assurance-certificate/v1 certificate");
  }
  return Buffer.from(
    `${ASSURANCE_SIGNATURE_SCHEMA}\n${JSON.stringify(canonicalize(certificate))}`,
    "utf8",
  );
}

function publicKeyMaterial(publicKey) {
  const key = createPublicKey(publicKey);
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error("assurance signature requires an Ed25519 public key");
  }
  const spki = key.export({ format: "der", type: "spki" });
  const pem = key.export({ format: "pem", type: "spki" }).toString();
  const keyId = `sha256:${createHash("sha256").update(spki).digest("hex")}`;
  return { key, pem, keyId };
}

export function signAssuranceCertificate(certificate, privateKey) {
  const key = createPrivateKey(privateKey);
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error("assurance signature requires an Ed25519 private key");
  }

  const publicMaterial = publicKeyMaterial(createPublicKey(key));
  const bytes = canonicalCertificateBytes(certificate);
  const signatureBase64 = cryptoSign(null, bytes, key).toString("base64");

  return {
    schema: ASSURANCE_SIGNATURE_SCHEMA,
    certificate,
    signature: {
      algorithm: "Ed25519",
      keyId: publicMaterial.keyId,
      publicKeyPem: publicMaterial.pem,
      signatureBase64,
    },
  };
}

export function verifyAssuranceSignature(envelope, options = {}) {
  try {
    if (!envelope || envelope.schema !== ASSURANCE_SIGNATURE_SCHEMA) return false;
    if (envelope.signature?.algorithm !== "Ed25519") return false;
    if (typeof envelope.signature?.signatureBase64 !== "string") return false;
    if (typeof envelope.signature?.publicKeyPem !== "string") return false;

    const publicMaterial = publicKeyMaterial(envelope.signature.publicKeyPem);
    if (publicMaterial.keyId !== envelope.signature.keyId) return false;
    if (options.expectedKeyId && options.expectedKeyId !== publicMaterial.keyId) return false;

    const bytes = canonicalCertificateBytes(envelope.certificate);
    const signature = Buffer.from(envelope.signature.signatureBase64, "base64");
    return cryptoVerify(null, bytes, publicMaterial.key, signature);
  } catch {
    return false;
  }
}
