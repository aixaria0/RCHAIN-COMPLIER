import { rchainAssuranceSchema } from "./rchain-assurance-schema.ts";

type Schema = { type?: string; const?: unknown; enum?: readonly unknown[]; anyOf?: readonly Schema[]; $ref?: string; properties?: Record<string, Schema>; required?: readonly string[]; additionalProperties?: boolean; items?: Schema; minLength?: number; maxLength?: number; maxItems?: number; minimum?: number; maximum?: number; pattern?: string };
/** Closed validator for the keywords used in the canonical v1 schema. */
export function validateRevTransferPackage(value: unknown): string[] {
  const errors: string[] = [];
  const root = rchainAssuranceSchema as unknown as Schema & { $defs: Record<string, Schema> };
  function visit(v: unknown, s: Schema, path: string, out: string[]): void {
    if (s.$ref) return visit(v, root.$defs[s.$ref.replace("#/$defs/", "")], path, out);
    if (s.anyOf) {
      if (!s.anyOf.some((candidate) => { const e: string[] = []; visit(v, candidate, path, e); return !e.length; })) out.push(`${path}: no allowed representation`);
      return;
    }
    if ("const" in s && v !== s.const) out.push(`${path}: wrong constant`);
    if (s.enum && !s.enum.includes(v)) out.push(`${path}: invalid state`);
    if (s.type === "null" && v !== null) out.push(`${path}: expected null`);
    if (s.type === "string") {
      if (typeof v !== "string" || v.length < (s.minLength ?? 0) || v.length > (s.maxLength ?? Infinity) || (s.pattern && !new RegExp(s.pattern).test(v))) out.push(`${path}: invalid string`);
    }
    if (s.type === "integer" && (typeof v !== "number" || !Number.isSafeInteger(v) || v < (s.minimum ?? -Infinity) || v > (s.maximum ?? Infinity))) out.push(`${path}: invalid integer`);
    if (s.type === "array") {
      if (!Array.isArray(v) || v.length > (s.maxItems ?? Infinity)) out.push(`${path}: invalid array`);
      else v.forEach((item, i) => visit(item, s.items!, `${path}/${i}`, out));
    }
    if (s.type === "object") {
      if (!v || typeof v !== "object" || Array.isArray(v)) { out.push(`${path}: expected object`); return; }
      const record = v as Record<string, unknown>;
      for (const key of s.required ?? []) if (!Object.hasOwn(record, key)) out.push(`${path}/${key}: missing`);
      for (const [key, item] of Object.entries(record)) {
        if (!Object.hasOwn(s.properties ?? {}, key)) { if (s.additionalProperties === false) out.push(`${path}/${key}: unknown field`); }
        else visit(item, s.properties![key], `${path}/${key}`, out);
      }
    }
  }
  visit(value, root, "", errors);
  return errors;
}
export function canonicalAssurance(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalAssurance).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalAssurance((value as Record<string, unknown>)[key])}`).join(",")}}`;
  throw new Error("Non-canonical evidence value");
}
export async function assuranceDigest(value: unknown): Promise<string> {
  return rawAssuranceDigest(canonicalAssurance(value));
}
export async function rawAssuranceDigest(bytes: string): Promise<string> {
  const hash = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(bytes));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}
export async function assurancePayloadDigest(pkg: any): Promise<string> {
  const copy = structuredClone(pkg);
  delete copy.provenance.payload_digest;
  return assuranceDigest(copy);
}
export async function assuranceReproductionDigest(pkg: any): Promise<string> {
  return assuranceDigest({ execution: pkg.execution, inclusion: pkg.inclusion, finalized_state: pkg.finalized_state, agreement: pkg.agreement, observers: pkg.observers.map(({ evidence: _e, observation_digest: _d, ...summary }: any) => summary) });
}
