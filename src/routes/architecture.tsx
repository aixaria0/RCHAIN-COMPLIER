import { createFileRoute } from "@tanstack/react-router";
import { LAYERS } from "@/lib/compiler";
import { useWorkbench } from "@/lib/workbench-state";
import { MobileNav } from "@/components/wb/shell";
import { Panel, StatusTag } from "@/components/wb/primitives";

export const Route = createFileRoute("/architecture")({
  component: Architecture,
});

function Architecture() {
  const { reality } = useWorkbench();
  return (
    <div className="grid gap-3">
      <MobileNav />
      <Panel title="Vertical architecture" subtitle="One responsibility per repository — not a fusion">
        <ol className="space-y-2">
          {LAYERS.map((l, i) => (
            <li key={l.id} className="rounded-lg border border-border bg-bg p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-mono text-micro tabular-nums text-muted">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1 text-sm font-medium">{l.label}</span>
                <span className="font-mono text-micro text-primary">{l.repo}</span>
              </div>
              <p className="mt-1 text-xs text-muted">{l.role}</p>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Claim boundaries" subtitle="What each layer is allowed to say">
        <div className="grid gap-2">
          {reality.claims.map((c) => (
            <article key={c.layer} className="rounded-lg border border-border bg-bg p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-micro tracking-label text-primary">{c.layer}</span>
                <StatusTag status={c.status} />
              </div>
              <p className="mt-2 text-sm">{c.statement}</p>
              <p className="mt-1 text-xs text-muted">Basis: {c.basis}</p>
              <p className="mt-1 text-xs text-subtle">Not claimed: {c.notClaimed}</p>
            </article>
          ))}
        </div>
      </Panel>

      <Panel title="Honest scope">
        <ul className="space-y-2 text-sm text-muted">
          <li>The ρ-calculus reducer implements NEW and COMM over a tuple space. It is not the full rchain-rust evaluator.</li>
          <li>The exchange is the QuantumOS 2PC (prepare / prepareReceive / commit / abort) with per-pool conservation.</li>
          <li>QLF certificates apply toSpectralMode to the event’s phase string. They do not formalize RChain.</li>
          <li>Sentinel reports observed node-count agreement. Stake-weighted Casper finality is not claimed.</li>
          <li>Sovereign Lattice analyses a PBFT-shaped vote set (N=3f+1). It does not claim Casper is PBFT.</li>
          <li>BLS signatures are structural placeholders, not pairing-verified against BLS12-381.</li>
          <li>No live RNode is queried. Every hash is produced by the in-browser compiler.</li>
        </ul>
      </Panel>
    </div>
  );
}
