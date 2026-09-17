import { shortHex } from "@/lib/compiler";
import { useWorkbench } from "@/lib/workbench-state";
import { EvidenceList, FieldRow, Mono, Panel, StatusTag } from "./primitives";

export function EnvelopeCard() {
  const { envelope, reality } = useWorkbench();
  if (!envelope) return null;
  const status = envelope.verificationResults[0] ?? reality.status;
  return (
    <Panel
      title="Event envelope"
      subtitle="Cryptographically linked evidence object — Git for execution"
      right={<StatusTag status={status} />}
    >
      <FieldRow label="event" value={envelope.eventId} source="EventEnvelope" field="event_id" />
      <FieldRow
        label="parent"
        value={envelope.parentEvent ?? "genesis"}
        source="EventEnvelope"
        field="parent_event"
      />
      <FieldRow label="layer" value={envelope.layer} source="EventEnvelope" field="layer" />
      <FieldRow
        label="capability"
        value={envelope.actorCapability ?? "ABSENT"}
        source="EventEnvelope"
        field="actor_capability"
        unavailable={!envelope.actorCapability}
      />
      <FieldRow
        label="envelope hash"
        value={shortHex(envelope.hash, 8, 8)}
        source="EventEnvelope"
        field="hash"
      />
      <FieldRow
        label="prev hash"
        value={envelope.prevHash ? shortHex(envelope.prevHash, 8, 8) : "genesis"}
        source="EventEnvelope"
        field="prev_hash"
      />
      {envelope.blockHash ? (
        <FieldRow label="block" value={shortHex(envelope.blockHash)} source="EventEnvelope" field="block_hash" />
      ) : null}
      {envelope.executionTraceHash ? (
        <FieldRow
          label="trace"
          value={shortHex(envelope.executionTraceHash)}
          source="EventEnvelope"
          field="execution_trace_hash"
        />
      ) : null}
      <p className="mt-3 text-xs text-muted">{envelope.summary}</p>
      <div className="mt-3">
        <EvidenceList evidence={envelope.fields} />
      </div>
    </Panel>
  );
}

export function RealityRecordPanel() {
  const { realityRecord } = useWorkbench();
  const replayStatus = realityRecord.replay.state === "REPRODUCED"
    ? "PASS"
    : realityRecord.replay.state === "DIVERGENT"
      ? "FAIL"
      : "UNAVAILABLE";

  return (
    <Panel
      title="Reality Certificate"
      subtitle="Portable evidence artifact — independently inspectable"
      right={<span className="rounded-full border border-border px-2 py-1 font-mono text-micro tracking-label">{realityRecord.state}</span>}
    >
      <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
        <div className="bg-elevated p-3">
          <div className="font-mono text-micro tracking-label text-muted">RECORD</div>
          <div className="mt-1 font-mono text-xs break-all">{shortHex(realityRecord.integrity.recordDigest, 10, 10)}</div>
        </div>
        <div className="bg-elevated p-3">
          <div className="font-mono text-micro tracking-label text-muted">INTEGRITY</div>
          <div className="mt-1 text-xs">{realityRecord.integrity.algorithm} · sealed</div>
        </div>
        <div className="bg-elevated p-3">
          <div className="font-mono text-micro tracking-label text-muted">EVIDENCE</div>
          <div className="mt-1 text-xs">{realityRecord.observations.length} observations · {realityRecord.claims.length} claims</div>
        </div>
        <div className="bg-elevated p-3">
          <div className="font-mono text-micro tracking-label text-muted">VERIFICATION</div>
          <div className="mt-1 text-xs">{realityRecord.verification.length} predicates</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusTag status={replayStatus} />
        <span className="text-xs text-muted">
          replay: {realityRecord.replay.available ? realityRecord.replay.state.toLowerCase() : "not available"}
        </span>
        <span className="text-xs text-muted">
          deps: {realityRecord.dependencies.length} · transforms: {realityRecord.transformations.length}
        </span>
      </div>

      <details className="mt-3 rounded-md border border-border bg-bg p-3">
        <summary className="cursor-pointer font-mono text-xxs tracking-label text-muted">INSPECT RECORD CONTRACT</summary>
        <pre className="mt-3 max-h-80 overflow-auto font-mono text-xxs leading-relaxed text-fg">
          {JSON.stringify(realityRecord, null, 2)}
        </pre>
      </details>
    </Panel>
  );
}

export function WhyPanel() {
  const { reality } = useWorkbench();
  return (
    <Panel title="Why this block?" subtitle="Assembled from the envelope chain — not a finality proof">
      <ol className="space-y-2">
        {reality.why.map((line, i) => (
          <li key={i} className="flex gap-3 text-sm leading-snug">
            <span className="font-mono text-micro tabular-nums text-muted">{String(i + 1).padStart(2, "0")}</span>
            <span>{line}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function WitnessPanel() {
  const { reality } = useWorkbench();
  if (!reality.witness) {
    return (
      <Panel title="Failure witness" subtitle="First unsatisfied invariant, if any">
        <p className="text-sm text-muted">No failure witness — all selected invariants satisfied or unavailable.</p>
      </Panel>
    );
  }
  const w = reality.witness;
  return (
    <Panel title="Failure witness" subtitle="First place reality diverged" right={<StatusTag status={w.verification} />}>
      <FieldRow label="layer" value={w.layer} />
      <FieldRow label="invariant" value={`${w.invariantId} · ${w.invariant}`} />
      <FieldRow label="expected" value={w.expected} source={w.source} field={w.field} />
      <FieldRow label="observed" value={w.observed} source={w.source} field={w.field} />
      <p className="mt-3 text-sm text-muted">{w.impact}</p>
    </Panel>
  );
}

export function QlfPanel() {
  const { reality } = useWorkbench();
  const q = reality.qlf;
  if (!q) return null;
  return (
    <Panel title="QLF certificate" subtitle="Event-level logical certificate — not a chain proof" right={<StatusTag status={q.balanced ? "PASS" : "FAIL"} />}>
      <div className="mb-3 font-mono text-lg tracking-[0.4em] text-evidence">{q.phaseString || "∅"}</div>
      <FieldRow label="count(+)" value={String(q.countPos)} source="QLF" field="count_pos" />
      <FieldRow label="count(−)" value={String(q.countNeg)} source="QLF" field="count_neg" />
      <FieldRow label="spectral gap" value={String(q.spectralGap)} source="QLF" field="spectral_gap" />
      <FieldRow label="symmetric" value={String(q.symmetric)} source="QLF" field="symmetric" />
      <FieldRow label="hermitian" value="true" source="QLF" field="toSpectralMode_hermitian" />
      <FieldRow label="spectral form" value={q.spectralForm} source="QLF" field="spectral_form" />
      <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border font-mono text-sm">
        <div className="bg-elevated p-3 text-center">{q.matrix[0][0]}</div>
        <div className="bg-elevated p-3 text-center text-muted">{q.matrix[0][1]}</div>
        <div className="bg-elevated p-3 text-center text-muted">{q.matrix[1][0]}</div>
        <div className="bg-elevated p-3 text-center">{q.matrix[1][1]}</div>
      </div>
      <p className="mt-3 text-xs text-muted">{q.claim}</p>
      <p className="mt-1 text-xs text-subtle">{q.notClaimed}</p>
    </Panel>
  );
}

export function SourcePanel() {
  const { reality } = useWorkbench();
  return (
    <Panel title="Rholang process" subtitle="Normalized process compiled from the QuantumOS event">
      {reality.rholangSource ? (
        <pre className="overflow-auto rounded-md bg-bg p-3 font-mono text-xxs leading-relaxed text-fg">
          {reality.rholangSource}
        </pre>
      ) : (
        <p className="text-sm text-muted">UNAVAILABLE — no process deployed (capability missing).</p>
      )}
      {reality.execution ? (
        <div className="mt-3">
          <FieldRow label="COMMs" value={String(reality.execution.comms)} source="ExecutionTrace" field="comms" />
          <FieldRow label="state hash" value={reality.execution.stateHash} source="ExecutionTrace" field="state_hash" />
          <FieldRow label="trace hash" value={reality.execution.traceHash} source="ExecutionTrace" field="trace_hash" />
        </div>
      ) : null}
    </Panel>
  );
}

export function ReductionPanel() {
  const { reality } = useWorkbench();
  if (!reality.execution) {
    return (
      <Panel title="ρ-calculus reduction">
        <p className="text-sm text-muted">UNAVAILABLE — nothing to reduce.</p>
      </Panel>
    );
  }
  return (
    <Panel title="ρ-calculus reduction" subtitle="NEW binds unforgeables; COMM is the rspace match">
      <ol className="space-y-1">
        {reality.execution.steps.map((s) => (
          <li key={s.n} className="flex gap-3 rounded-md px-1 py-1 font-mono text-xxs">
            <span className="tabular-nums text-muted">{s.n}</span>
            <span className="w-14 text-primary">{s.rule}</span>
            <span className="min-w-0 flex-1 break-all text-fg">{s.description}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function ExchangePanel() {
  const { reality } = useWorkbench();
  if (!reality.exchange) return null;
  const pools = Object.values(reality.exchange.pools);
  return (
    <Panel title="Exchange state" subtitle="prepare → prepareReceive → commit/abort · per-pool conservation">
      <div className="grid gap-3 sm:grid-cols-2">
        {pools.map((p) => (
          <div key={p.id} className="rounded-md border border-border bg-bg p-3">
            <div className="flex items-baseline justify-between">
              <Mono>{p.id}</Mono>
              <span className="font-mono text-micro text-muted">{p.shard}</span>
            </div>
            <FieldRow label="rate" value={`${p.rate} / 1e6`} />
            <FieldRow label="reserve A" value={String(p.reserveA)} />
            <FieldRow label="reserve B" value={String(p.reserveB)} />
            {Object.entries(p.balances).map(([who, b]) => (
              <FieldRow key={who} label={`${who} bal`} value={`A ${b.a} · B ${b.b}`} />
            ))}
          </div>
        ))}
      </div>
      <ol className="mt-3 space-y-1">
        {reality.exchange.events.map((e, i) => (
          <li key={i} className="flex gap-2 font-mono text-xxs">
            <span className={e.ok ? "text-pass" : "text-fail"}>{e.ok ? "ok" : "no"}</span>
            <span className="text-primary">{e.verb}</span>
            <span className="text-muted">{e.detail}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
