import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const protocolNeutralFiles = [
  new URL("./lexicographic-possibility.ts", import.meta.url),
  new URL("./verification-compiler.ts", import.meta.url),
  new URL("./finite-state-verifier.ts", import.meta.url),
  new URL("./quantitative-what-if.ts", import.meta.url),
];

const forbiddenImports = [
  /from\s+["'][^"']*\.\.\/cbc\//,
  /from\s+["'][^"']*sentinel/i,
  /from\s+["'][^"']*native-replay/i,
  /from\s+["'][^"']*assurance-fabric/i,
  /from\s+["'][^"']*rchain/i,
];

test("protocol-agnostic verification core has no domain-specific imports", async () => {
  for (const file of protocolNeutralFiles) {
    const source = await readFile(file, "utf8");
    for (const forbidden of forbiddenImports) {
      assert.equal(
        forbidden.test(source),
        false,
        `${file.pathname} crosses the protocol-neutral dependency boundary: ${forbidden}`,
      );
    }
  }
});
