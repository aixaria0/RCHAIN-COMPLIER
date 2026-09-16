import { createFileRoute } from "@tanstack/react-router";
import { useWorkbench } from "@/lib/workbench-state";
import { MobileNav } from "@/components/wb/shell";
import { WitnessPanel, WhyPanel } from "@/components/wb/envelope";
import { GhostBtn, Panel, StatusTag, FieldRow } from "@/components/wb/primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/counterfactual")({
  component: Counterfactual,
});

function Counterfactual() {
  const { applicableMutations, mutation, setMutation, reality, baseline, diff } = useWorkbench();
  return (
    <div className="grid gap-3">
      <MobileNav />
      <Panel
        title="Counterfactual reality"
        subtitle="Remove one fact. Recompute evidence. Report the first violated invariant."
      >
        <div className="grid gap-2">
          {applicableMutations.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMutation(m.id)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors duration-(--motion-quick)",
                mutation === m.id ? "border-primary/50 bg-elevated" : "border-border bg-bg hover:border-border-strong",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{m.title}</span>
                {mutation === m.id ? <StatusTag status={reality.status} /> : null}
              </div>
              <p className="mt-1 text-xs text-muted">{m.summary}</p>
            </button>
          ))}
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Baseline" right={<StatusTag status={baseline.status} />}>
          <FieldRow label="capability" value={baseline.qos.capability ?? "ABSENT"} />
          <FieldRow label="COMMs" value={String(baseline.execution?.comms ?? "n/a")} />
          <FieldRow label="block" value={baseline.blocks[0]?.hash ?? "UNAVAILABLE"} unavailable={!baseline.blocks[0]} />
          <FieldRow
            label="agreement"
            value={baseline.cross ? baseline.cross.agreementRatio.toFixed(2) : "UNAVAILABLE"}
            unavailable={!baseline.cross}
          />
          <FieldRow
            label="committed cert"
            value={String(baseline.lattice?.committedCertificate ?? "n/a")}
          />
        </Panel>
        <Panel title="Counterfactual" right={<StatusTag status={reality.status} />}>
          <FieldRow label="capability" value={reality.qos.capability ?? "ABSENT"} />
          <FieldRow label="COMMs" value={String(reality.execution?.comms ?? "n/a")} />
          <FieldRow label="block" value={reality.blocks[0]?.hash ?? "UNAVAILABLE"} unavailable={!reality.blocks[0]} />
          <FieldRow
            label="agreement"
            value={reality.cross ? reality.cross.agreementRatio.toFixed(2) : "UNAVAILABLE"}
            unavailable={!reality.cross}
          />
          <FieldRow
            label="committed cert"
            value={String(reality.lattice?.committedCertificate ?? "n/a")}
          />
        </Panel>
      </div>

      <Panel title="First divergence" subtitle="The earliest layer whose object changed">
        {diff.first ? (
          <div>
            <FieldRow label="layer" value={diff.first.layer} />
            <FieldRow label="field" value={diff.first.field} />
            <FieldRow label="baseline" value={diff.first.a} />
            <FieldRow label="counterfactual" value={diff.first.b} />
            {diff.downstream.length ? (
              <div className="mt-3">
                <p className="mb-2 font-mono text-micro tracking-label text-muted">DOWNSTREAM EFFECTS</p>
                {diff.downstream.map((r) => (
                  <FieldRow key={r.field} label={`${r.layer}.${r.field}`} value={`${r.a} → ${r.b}`} />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted">No further downstream fields changed.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">No divergence — this is the baseline.</p>
        )}
      </Panel>

      <WitnessPanel />
      <WhyPanel />

      <div className="flex flex-wrap gap-2">
        <GhostBtn onClick={() => setMutation("none")}>Return to baseline</GhostBtn>
      </div>
    </div>
  );
}
