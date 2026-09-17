import { useMemo } from "react";
import {
  evaluateRealityTerm,
  termCheck,
  termCompose,
  termObservation,
  termReplay,
  termRequire,
  type RealityDerivation,
  type RealityTerm,
} from "@/lib/compiler";
import { shortHex } from "@/lib/compiler";
import { useWorkbench } from "@/lib/workbench-state";
import { Expandable, Panel, StatusTag } from "./primitives";

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
          <StatusTag status={node.conclusion.state} />
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

  return (
    <Panel
      title="Reality Calculus"
      subtitle="OBS → COMP → REQ → CHK → REP · derivation, not assertion"
      right={<StatusTag status={result.judgement.state} />}
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="grid gap-2">
          <div className="rounded-lg border border-border bg-bg p-3">
            <div className="font-mono text-micro tracking-label text-muted">DERIVATION ROOT</div>
            <div className="mt-1 text-sm text-foreground">{result.derivation.rule} → {result.judgement.state}</div>
            <p className="mt-2 text-xs text-muted">{result.judgement.reason}</p>
          </div>
          <Expandable
            header={<span className="font-mono text-micro tracking-label text-primary">SHOW DERIVATION TREE</span>}
          >
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
    </Panel>
  );
}
