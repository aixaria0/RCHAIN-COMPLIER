import { createHash, sign, verify, createPrivateKey, createPublicKey } from "node:crypto";
import type { PortableAssurancePackage } from "./portable-assurance-package.ts";
import { verifyPortableAssurancePackage } from "./portable-assurance-package.ts";

export const SIGNED_PACKAGE_ROOT_SCHEMA = "causal-assurance-signed-root/v2" as const;

function sha256Bytes(bytes: Uint8Array): string {
  return "sha256:" + createHash("sha256").update(bytes).digest("hex");
}

function encodeLengthPrefixed(fields: readonly string[]): Buffer {
  const chunks: Buffer[] = [];
  for (const field of fields) {
    const bytes = Buffer.from(field, "utf8");
    if (bytes.length > 0xffffffff) throw new Error("canonical field exceeds u32 length");
    const length = Buffer.allocUnsafe(4);
    length.writeUInt32BE(bytes.length, 0);
    chunks.push(length, bytes);
  }
  return Buffer.concat(chunks);
}

function rootFields(pkg: PortableAssurancePackage): string[] {
  return [
    SIGNED_PACKAGE_ROOT_SCHEMA,
    pkg.schema,
    pkg.runId,
    pkg.subject,
    ...pkg.artifacts.flatMap((artifact, index) => [
      String(index),
      artifact.role,
      artifact.sha256,
      String(artifact.bindsTo.length),
      ...artifact.bindsTo,
    ]),
  ];
}

export function canonicalPackageRoot(pkg: PortableAssurancePackage): string {
  const verified = verifyPortableAssurancePackage(pkg);
  if (!verified.valid) throw new Error(`cannot root invalid package: ${verified.reason}`);
  return sha256Bytes(encodeLengthPrefixed(rootFields(pkg)));
}

export function signedPackageSignerKeyId(publicKeyPem: string): string {
  const der = createPublicKey(publicKeyPem).export({ type: "spki", format: "der" });
  return sha256Bytes(der);
}

function signatureMaterial(packageRoot: string, keyId: string): Buffer {
  return encodeLengthPrefixed([SIGNED_PACKAGE_ROOT_SCHEMA, packageRoot, keyId]);
}

export interface SignedPackageRoot {
  schema: typeof SIGNED_PACKAGE_ROOT_SCHEMA;
  packageRoot: string;
  keyId: string;
  publicKeyPem: string;
  signatureBase64: string;
}

export function signPackageRoot(pkg: PortableAssurancePackage, privateKeyPem: string): SignedPackageRoot {
  const packageRoot = canonicalPackageRoot(pkg);
  const privateKey = createPrivateKey(privateKeyPem);
  const publicKeyPem = createPublicKey(privateKey).export({ type: "spki", format: "pem" }).toString();
  const keyId = signedPackageSignerKeyId(publicKeyPem);
  const signatureBase64 = sign(null, signatureMaterial(packageRoot, keyId), privateKey).toString("base64");
  return { schema: SIGNED_PACKAGE_ROOT_SCHEMA, packageRoot, keyId, publicKeyPem, signatureBase64 };
}

/**
 * Fail-closed verification: the embedded public key never establishes trust by itself.
 * The caller must provide the independently pinned signer fingerprint it expects.
 */
export function verifySignedPackageRoot(
  pkg: PortableAssurancePackage,
  envelope: SignedPackageRoot,
  expectedKeyId: string,
): boolean {
  if (envelope.schema !== SIGNED_PACKAGE_ROOT_SCHEMA) return false;
  if (!/^sha256:[0-9a-f]{64}$/i.test(expectedKeyId)) return false;

  let root: string;
  try { root = canonicalPackageRoot(pkg); } catch { return false; }
  if (root.toLowerCase() !== envelope.packageRoot.toLowerCase()) return false;

  try {
    const actualKeyId = signedPackageSignerKeyId(envelope.publicKeyPem);
    if (actualKeyId.toLowerCase() !== envelope.keyId.toLowerCase()) return false;
    if (actualKeyId.toLowerCase() !== expectedKeyId.toLowerCase()) return false;
    return verify(
      null,
      signatureMaterial(root, actualKeyId),
      createPublicKey(envelope.publicKeyPem),
      Buffer.from(envelope.signatureBase64, "base64"),
    );
  } catch {
    return false;
  }
}
