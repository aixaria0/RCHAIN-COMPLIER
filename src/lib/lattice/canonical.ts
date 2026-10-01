import { sha256Artifact } from "../compiler/ecosystem-chain.ts";
export const MAX_EVENT_BYTES = 16384;
export function canonical(value: unknown): string {
  const ancestors = new Set<object>();
  function encode(item: unknown, depth: number): string {
    if (depth > 12) throw new Error("canonical depth limit");
    if (item === null || typeof item === "boolean") return JSON.stringify(item);
    if (typeof item === "number") {
      if (!Number.isSafeInteger(item) || Object.is(item, -0))
        throw new Error("safe integer required");
      return String(item);
    }
    if (typeof item === "string") {
      if (
        item.length > MAX_EVENT_BYTES ||
        /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(item)
      )
        throw new Error("scalar Unicode required");
      return JSON.stringify(item);
    }
    if (!item || typeof item !== "object") throw new Error("unsupported canonical value");
    if (ancestors.has(item)) throw new Error("cyclic canonical value");
    ancestors.add(item);
    try {
      const array = Array.isArray(item),
        proto = Object.getPrototypeOf(item);
      if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null)
        throw new Error("plain data required");
      const descriptors = Object.getOwnPropertyDescriptors(item),
        keys = Reflect.ownKeys(descriptors);
      if (keys.some((k) => typeof k !== "string")) throw new Error("symbol keys forbidden");
      if (array) {
        if (item.length > 256 || keys.length !== item.length + 1)
          throw new Error("dense bounded array required");
        return `[${Array.from({ length: item.length }, (_, i) => {
          const d = descriptors[String(i)];
          if (!d || !("value" in d) || !d.enumerable) throw new Error("array data required");
          return encode(d.value, depth + 1);
        }).join(",")}]`;
      }
      if (keys.length > 64) throw new Error("object key limit");
      return `{${(keys as string[])
        .sort()
        .map((k) => {
          const d = descriptors[k]!;
          if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(k) || !("value" in d) || !d.enumerable)
            throw new Error("canonical key/data required");
          return `${JSON.stringify(k)}:${encode(d.value, depth + 1)}`;
        })
        .join(",")}}`;
    } finally {
      ancestors.delete(item);
    }
  }
  const result = encode(value, 0);
  if (Buffer.byteLength(result) > MAX_EVENT_BYTES) throw new Error("canonical byte limit");
  return result;
}
export function parseCanonical(bytes: Uint8Array | string): unknown {
  const input =
    typeof bytes === "string"
      ? bytes
      : new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  if (Buffer.byteLength(input) > MAX_EVENT_BYTES) throw new Error("canonical byte limit");
  const value: unknown = JSON.parse(input);
  if (canonical(value) !== input) throw new Error("noncanonical bytes");
  return value;
}
export function artifactDigest(content: unknown): string {
  return sha256Artifact(canonical(content));
}
