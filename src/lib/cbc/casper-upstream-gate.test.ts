import assert from "node:assert/strict";
import test from "node:test";
import { traceUpstreamFinalizerGate } from "./casper-upstream-gate.ts";

test("incomplete minimum-message coverage is blocked before calculate_fringe", () => {
  const trace = traceUpstreamFinalizerGate({
    bondedValidators: ["v0", "v1"],
    minimumMessageSenders: ["v0"],
  });

  assert.equal(trace.minimumMessageCount, 1);
  assert.equal(trace.distinctMinimumMessageCount, 1);
  assert.equal(trace.checkMinMessagesPassed, false);
  assert.equal(trace.calculateFringeReachable, false);
  assert.equal(trace.gate, "CHECK_MIN_MESSAGES");
  assert.equal(trace.conclusion, "BLOCKED_BEFORE_FRINGE");
});

test("complete minimum-message coverage reaches calculate_fringe", () => {
  const trace = traceUpstreamFinalizerGate({
    bondedValidators: ["v0", "v1"],
    minimumMessageSenders: ["v0", "v1"],
  });

  assert.equal(trace.minimumMessageCount, 2);
  assert.equal(trace.distinctMinimumMessageCount, 2);
  assert.equal(trace.checkMinMessagesPassed, true);
  assert.equal(trace.calculateFringeReachable, true);
  assert.equal(trace.gate, "CALCULATE_FRINGE");
  assert.equal(trace.conclusion, "FRINGE_STAGE_REACHABLE");
});

test("duplicate entries remain count-valid even when sender coverage is incomplete", () => {
  const trace = traceUpstreamFinalizerGate({
    bondedValidators: ["v0", "v1", "v2", "v3"],
    minimumMessageSenders: ["v0", "v0", "v1", "v2"],
  });

  assert.equal(trace.minimumMessageCount, 4);
  assert.equal(trace.distinctMinimumMessageCount, 3);
  assert.equal(trace.checkMinMessagesPassed, true);
  assert.equal(trace.calculateFringeReachable, true);
  assert.equal(trace.gate, "CALCULATE_FRINGE");
  assert.equal(trace.conclusion, "FRINGE_STAGE_REACHABLE");
});
