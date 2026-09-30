import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { conformanceVector } from "../../../examples/lattice-vectors.ts";
test("public cross-language golden bytes and Ed25519 signature remain stable", () => {
  const expected = JSON.parse(
    readFileSync(
      new URL("../../../schemas/intelligence-lattice-vectors-v1.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(conformanceVector(), expected);
});
