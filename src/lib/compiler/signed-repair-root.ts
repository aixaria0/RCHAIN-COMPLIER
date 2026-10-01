import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";
import {
  REPAIR_PACKAGE_SCHEMA,
  type RepairPackage,
  verifyRepairPackage,
} from "./repair-package.ts";
import { signedPackageSignerKeyId } from "./signed-package-root.ts";

export const SIGNED_REPAIR_ROOT_SCHEMA =
  "causal-assurance-repair-signed-root/v1" as const;

function sha256Bytes(bytes: Uint8Array): string {
  return "sha256:" + createHash("sha256").update(bytes).digest("hex");
}

function encodeLengthPrefixed(fields: readonly string[]): Buffer {
  const chunks: Buffer[] = [];
  for (const field of fields) {
    const bytes = Buffer.from(field, "utf8");
    if (bytes.length > 0xffffffff) {
      throw new Error("canonical repair field exceeds u32 length");
    }
    const length = Buffer.allocUnsafe(4);
    length.writeUInt32BE(bytes.length, 0);
    chunks.push(length, bytes);
  }
  return Buffer.concat(chunks);
}

function rootFields(pkg: RepairPackage): string[] {
  return [
    SIGNED_REPAIR_ROOT_SCHEMA,
    REPAIR_PACKAGE_SCHEMA,
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

export function canonicalRepairPackageRoot(pkg: RepairPackage): string {
  const checked = verifyRepairPackage(pkg);
  if (!checked.valid) {
    throw new Error(`cannot root invalid repair package: ${checked.reason}`);
  }
  return sha256Bytes(encodeLengthPrefixed(rootFields(pkg)));
}

function signatureMaterial(root: string, keyId: string): Buffer {
  return encodeLengthPrefixed([SIGNED_REPAIR_ROOT_SCHEMA, root, keyId]);
}

export interface SignedRepairRoot {
  schema: typeof SIGNED_REPAIR_ROOT_SCHEMA;
  repairPackageRoot: string;
  keyId: string;
  publicKeyPem: string;
  signatureBase64: string;
}

export function signRepairPackageRoot(
  pkg: RepairPackage,
  privateKeyPem: string,
): SignedRepairRoot {
  const repairPackageRoot = canonicalRepairPackageRoot(pkg);
  const privateKey = createPrivateKey(privateKeyPem);
  const publicKeyPem = createPublicKey(privateKey)
    .export({ type: "spki", format: "pem" })
    .toString();
  const keyId = signedPackageSignerKeyId(publicKeyPem);
  const signatureBase64 = sign(
    null,
    signatureMaterial(repairPackageRoot, keyId),
    privateKey,
  ).toString("base64");

  return {
    schema: SIGNED_REPAIR_ROOT_SCHEMA,
    repairPackageRoot,
    keyId,
    publicKeyPem,
    signatureBase64,
  };
}

export function verifySignedRepairRoot(
  pkg: RepairPackage,
  envelope: SignedRepairRoot,
  expectedKeyId: string,
): boolean {
  if (envelope.schema !== SIGNED_REPAIR_ROOT_SCHEMA) return false;
  if (!/^sha256:[0-9a-f]{64}$/i.test(expectedKeyId)) return false;

  let root: string;
  try {
    root = canonicalRepairPackageRoot(pkg);
  } catch {
    return false;
  }

  if (root.toLowerCase() !== envelope.repairPackageRoot.toLowerCase()) {
    return false;
  }

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
