import { createHash, sign, verify, createPrivateKey, createPublicKey } from "node:crypto";
import type { PortableAssurancePackage } from "./portable-assurance-package.ts";
import { verifyPortableAssurancePackage } from "./portable-assurance-package.ts";

export const SIGNED_PACKAGE_ROOT_SCHEMA = "causal-assurance-signed-root/v1" as const;

function sha256(bytes: string): string {
  return "sha256:" + createHash("sha256").update(bytes, "utf8").digest("hex");
}

export function canonicalPackageRoot(pkg: PortableAssurancePackage): string {
  const verified = verifyPortableAssurancePackage(pkg);
  if (!verified.valid) throw new Error(`cannot root invalid package: ${verified.reason}`);
  const material = [
    SIGNED_PACKAGE_ROOT_SCHEMA,
    pkg.schema,
    pkg.runId,
    pkg.subject,
    ...pkg.artifacts.flatMap((a, i) => [
      String(i), a.role, a.sha256, String(a.bindsTo.length), ...a.bindsTo,
    ]),
  ].join("\0");
  return sha256(material);
}

export interface SignedPackageRoot {
  schema: typeof SIGNED_PACKAGE_ROOT_SCHEMA;
  packageRoot: string;
  publicKeyPem: string;
  signatureBase64: string;
}

export function signPackageRoot(pkg: PortableAssurancePackage, privateKeyPem: string): SignedPackageRoot {
  const packageRoot = canonicalPackageRoot(pkg);
  const privateKey = createPrivateKey(privateKeyPem);
  const publicKeyPem = createPublicKey(privateKey).export({ type: "spki", format: "pem" }).toString();
  const signatureBase64 = sign(null, Buffer.from(packageRoot, "utf8"), privateKey).toString("base64");
  return { schema: SIGNED_PACKAGE_ROOT_SCHEMA, packageRoot, publicKeyPem, signatureBase64 };
}

export function verifySignedPackageRoot(pkg: PortableAssurancePackage, envelope: SignedPackageRoot): boolean {
  if (envelope.schema !== SIGNED_PACKAGE_ROOT_SCHEMA) return false;
  let root: string;
  try { root = canonicalPackageRoot(pkg); } catch { return false; }
  if (root !== envelope.packageRoot) return false;
  try {
    return verify(null, Buffer.from(root, "utf8"), createPublicKey(envelope.publicKeyPem), Buffer.from(envelope.signatureBase64, "base64"));
  } catch { return false; }
}
