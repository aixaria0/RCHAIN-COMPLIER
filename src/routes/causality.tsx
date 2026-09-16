import { createFileRoute } from "@tanstack/react-router";
import { LAYERS, shortHex } from "@/lib/compiler";
import { useWorkbench } from "@/lib/workbench-state";
import { MobileNav } from "@/components/wb/shell";
import { EnvelopeCard, WitnessPanel } from "@/components/wb/envelope";
import { FieldRow, Mono, Panel, StatusTag } from "@/components/wb/primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/causality")({
  component: Causality,
});

function Causality() {
  const { reality, envelope, setSelectedEnvelope } = useWorkbench();
  return (
    <div className="grid gap-3">
      <MobileNav />
      <Panel
        title="Causality explorer"
        subtitle="Click an envelope. Provenance is a linked chain, not a block list."
        right={<StatusTag status={reality.status} />}
      >
        <div className="flex flex-col">
          {reality.envelopes.map((e, i) => {
            const meta = LAYERS.find((l) => l.id === e.layer);
            const active = envelope?.eventId === e.eventId;
            const st = e.verificationResults[0] ?? "UNAVAILABLE";
            return (
              <div key={e.eventId}>
                <button
                  type="button"
                  onClick={() => setSelectedEnvelope(e.eventId)}
                  className={cn(
                    "flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-3 text-left transition-colors duration-(--motion-quick)",
                    active ? "border-primary/50 bg-elevated" : "border-border bg-bg hover:border-border-strong",
                  )}
                >
                  <div>
                    <div className="font-mono text-micro tracking-label text-muted">{meta?.label ?? e.layer}</div>
                    <div className="text-sm font-medium">{e.label}</div>
                    <p className="mt-0.5 text-xs text-muted">{e.summary}</p>
                  </div>
                  <div className="text-right">
                    <StatusTag status={st} />
                    <Mono className="mt-1 block">{shortHex(e.hash)}</Mono>
                  </div>
                </button>
                {i < reality.envelopes.length - 1 ? (
                  <svg className="h-5 w-full" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden>
                    <line
                      x1="16"
                      y1="0"
                      x2="16"
                      y2="20"
                      className="flow-line"
                      stroke="currentColor"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                      style={{ color: "var(--color-border-strong)" }}
                    />
                  </svg>
                ) : null}
              </div>
            );
          })}
        </div>
      </Panel>
      <div className="grid gap-3 lg:grid-cols-2">
        <EnvelopeCard />
        <WitnessPanel />
      </div>
      {reality.blocks[0] ? (
        <Panel title={`Block #${reality.blocks[0].height}`} subtitle="Why does this block exist?">
          <FieldRow label="hash" value={reality.blocks[0].hash} source="FinalizedBlockEvidence" field="block_hash" />
          <FieldRow label="parent" value={reality.blocks[0].parentHash} source="FinalizedBlockEvidence" field="parent_hash" />
          <FieldRow label="proposer" value={reality.blocks[0].proposer} source="FinalizedBlockEvidence" field="proposer" />
          <FieldRow label="shard" value={reality.blocks[0].shard} source="NetworkStatus" field="shard_id" />
          <FieldRow label="post-state" value={reality.blocks[0].postStateHash} source="FinalizedBlockEvidence" field="post_state_hash" />
          <FieldRow
            label="deploys"
            value={reality.blocks[0].deploys.map((d) => d.id).join(", ") || "none"}
            source="FinalizedBlockEvidence"
            field="deploys"
          />
        </Panel>
      ) : (
        <Panel title="Block">
          <p className="text-sm text-muted">UNAVAILABLE — no block was produced under this origin.</p>
        </Panel>
      )}
    </div>
  );
}
