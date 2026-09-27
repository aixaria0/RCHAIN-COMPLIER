import assert from "node:assert/strict";
import test from "node:test";
import { sha256Artifact } from "./ecosystem-chain.ts";
import { CROSS_REPO_FIXTURE_V1, CROSS_REPO_FIXTURE_V1_SHA256 } from "./cross-repo-fixture.ts";

test("canonical cross-repo fixture has the frozen SHA-256 digest", () => {
  assert.equal(sha256Artifact(CROSS_REPO_FIXTURE_V1), CROSS_REPO_FIXTURE_V1_SHA256);
});
