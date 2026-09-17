import { useMemo } from "react";
import {
  detectEquivocation,
  evaluateRealityTerm,
  incompatible,
  proposition,
  selectMaximallyConsistentPropositions,
  termCheck,
  termCompose,
  termObservation,
  termReplay,
  termRequire,
  type RealityDerivation,
  type RealityState,
  type RealityTerm,
  type Status,
} from "@/lib/compiler";
import { shortHex } from "@/lib/compiler";
import { useWorkbench } from "@/lib/workbench-state";
import { Expandable, Panel, StatusTag } from "./primitives";

function toUiStatus(state: RealityState): Status {
  switch (state) {
    case "OBSERVED":
      return "WARN";
    case "CONSISTENT":
    case "REPRODUCED":
    case "VERIFIED":
      return "PASS";
    case "INCOMPLETE":
      return "UNAVAILABLE";
    case "DIVERGENT":
      return "FAIL";
  }
}

function derivationForRecord(record: ReturnType<typeof useWorkbench>["realityRecord"]): RealityTerm {
  const observation = record.observations[0];
  if (!observation) {
    return termRequire(["observation:missing"], { kind: "observation", observationId: "missing" });
  }

  let term: RealityTerm = termObservation(observation.id);
  const predicate = record.verification[0]?.predicate;
  if (predicate) term = termCheck(predicate, term);

  if (record.replay.expectedDigest && record.replay.observedDigest) {
    term = termReplay(record.replay.expectedDigest, record.replay.observedDigest, term);
  } else if (record.replay.inputIds.length) {
    term = termRequire(record.replay.inputIds, term);
  }

  if (record.observations.length > 1) {
    term = termCompose(term, termObservation(record.observations[1]!.id));
  }

  return term;
}

function RuleNode({ node, depth = 0 }: { node: RealityDerivation; depth?: number }) {
  return (
    <div className="relative pl-4">
      {depth > 0 ? <div className="absolute left-0 top-0 h-full border-l border-border" /> : null}
      <div className="rounded-lg border border-border bg-bg p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-border bg-panel px-2 py-0.5 font-mono text-micro tracking-label text-primary">
            {node.rule}
          </span>
          <StatusTag status={toUiStatus(node.conclusion.state)} />
          <span className="font-mono text-micro text-muted">state {node.conclusion.state}</span>
          <span className="font-mono text-micro text-muted">obs {node.conclusion.observationIds.length}</span>
          <span className="font-mono text-micro text-muted">proof {node.conclusion.verificationIds.length}</span>
        </div>
        <p className="mt-2 text-xs text-muted">{node.conclusion.reason}</p>
        {node.premises.length ? (
          <div className="mt-3 grid gap-2">
            {node.premises.map((premise, index) => (
              <RuleNode key={`${premise.rule}-${index}`} node={premise} depth={depth + 1} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function RealityCalculusPanel() {
  const { realityRecord } = useWorkbench();
  const result = useMemo(() => evaluateRealityTerm(realityRecord, derivationForRecord(realityRecord)), [realityRecord]);

  const propositionLens = useMemo(() => {
    const result = selectMaximallyConsistentPropositions([
      proposition("transaction t occurs before s", "p-order-1"),
      incompatible("transaction s occurs before t", "p-order-2", ["p-order-1"]),
      proposition("transaction r is independent", "p-independent"),
    ]);

    const equivocation = detectEquivocation([
      {
        source: "validator-A",
        target: "cycle-42",
        claim: "block-hash-A",
        belief: 0.82,
        justification: ["j-observation-1", "j-replay-1"],
      },
      {
        source: "validator-A",
        target: "cycle-42",
        claim: "block-hash-B",
        belief: 0.81,
        justification: ["j-observation-2"],
      },
      {
        source: "validator-B",
        target: "cycle-42",
        claim: "block-hash-A",
        belief: 0.91,
        justification: ["j-observation-1"],
      },
    ]);

    return { result, equivocation };
  }, []);

  return (
    <Panel
      title="Reality Calculus"
      subtitle="OBS → COMP → REQ → CHK → REP · derivation, not assertion"
      right={<StatusTag status={toUiStatus(result.judgement.state)} />}
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="grid gap-2">
          <div className="rounded-lg border border-border bg-bg p-3">
            <div className="font-mono text-micro tracking-label text-muted">DERIVATION ROOT</div>
            <div className="mt-1 text-sm text-foreground">{result.derivation.rule} → {result.judgement.state}</div>
            <p className="mt-2 text-xs text-muted">{result.judgement.reason}</p>
          </div>
          <Expandable header={<span className="font-mono text-micro tracking-label text-primary">SHOW DERIVATION TREE</span>}>
            <RuleNode node={result.derivation} />
          </Expandable>
        </div>
        <div className="rounded-lg border border-border bg-bg p-3 lg:w-72">
          <div className="font-mono text-micro tracking-label text-muted">CALCULUS DIGEST</div>
          <div className="mt-2 break-all font-mono text-xxs text-evidence">{shortHex(result.derivationDigest)}</div>
          <div className="mt-4 font-mono text-micro tracking-label text-muted">RECORD STATE</div>
          <div className="mt-1 text-sm">{realityRecord.state}</div>
          <div className="mt-4 font-mono text-micro tracking-label text-muted">OBSERVATIONS</div>
          <div className="mt-1 text-sm tabular-nums">{realityRecord.observations.length}</div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-bg p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-mono text-micro tracking-label text-primary">RCHAIN PROPOSITION LENS</div>
            <p className="mt-1 text-xs text-muted">SYNTHETIC FIXTURE · proposition consistency + validator equivocation</p>
          </div>
          <StatusTag status={propositionLens.result.judgement.state === "CONSISTENT" ? "PASS" : "WARN"} />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded border border-border bg-panel p-3">
            <div className="font-mono text-micro tracking-label text-muted">ACCEPTED</div>
            <div className="mt-1 text-lg tabular-nums">{propositionLens.result.accepted.length}</div>
            <div className="mt-2 space-y-1 font-mono text-xxs text-muted">
              {propositionLens.result.accepted.map((item) => <div key={item.id}>✓ {item.id}</div>)}
            </div>
          </div>
          <div className="rounded border border-border bg-panel p-3">
            <div className="font-mono text-micro tracking-label text-muted">BLOCKED</div>
            <div className="mt-1 text-lg tabular-nums">{propositionLens.result.rejected.length}</div>
            <div className="mt-2 space-y-1 font-mono text-xxs text-muted">
              {propositionLens.result.rejected.map((item) => <div key={item.id}>× {item.id}</div>)}
            </div>
          </div>
          <div className="rounded border border-border bg-panel p-3">
            <div className="font-mono text-micro tracking-label text-muted">FIXED POINT / EQV</div>
            <div className="mt-1 text-sm">{propositionLens.result.fixedPoint ? "STABLE" : "ITERATING"}</div>
            <div className="mt-2 font-mono text-xxs text-muted">equivocations {propositionLens.equivocation.length}</div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xxs text-muted">
          <span>judgement {propositionLens.result.judgement.state}</span>
          <span>rounds {propositionLens.result.trace.length}</span>
          <span>digest {shortHex(propositionLens.result.judgement.digest)}</span>
          {propositionLens.equivocation.length ? (
            <span className="text-danger">equivocation: {propositionLens.equivocation.map((item) => item.source).join(", ")}</span>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
