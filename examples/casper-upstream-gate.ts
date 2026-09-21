import { traceUpstreamFinalizerGate } from "../src/lib/cbc/casper-upstream-gate.ts";

const blocked = traceUpstreamFinalizerGate({
  bondedValidators: ["v0", "v1"],
  minimumMessageSenders: ["v0"],
});

const reachable = traceUpstreamFinalizerGate({
  bondedValidators: ["v0", "v1"],
  minimumMessageSenders: ["v0", "v1"],
});

console.log(JSON.stringify({ blocked, reachable }, null, 2));
