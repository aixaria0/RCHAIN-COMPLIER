import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { replay } from "../src/lib/lattice/replay.ts";
import type { runTwoNodeExperiment } from "./lattice-two-node.ts";
const path = process.argv[2];
if (!path || statSync(path).size > 8 * 1024 * 1024)
  throw new Error("bounded audit export required");
const recorded = JSON.parse(readFileSync(path, "utf8")) as Awaited<
  ReturnType<typeof runTwoNodeExperiment>
>;
if (recorded.schema !== "intelligence-lattice-experiment/v1") throw new Error("unsupported export");
const view = replay(recorded.events.slice().reverse(), recorded.policy);
assert.deepEqual(view, recorded.view);
process.stdout.write(
  JSON.stringify(
    {
      reproduced: true,
      eventRoot: view.eventRoot,
      eventCount: view.eventCount,
      decisions: view.decisions,
    },
    null,
    2,
  ) + "\n",
);
