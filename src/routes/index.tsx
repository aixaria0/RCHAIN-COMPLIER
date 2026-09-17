import { createFileRoute } from "@tanstack/react-router";
import { SCENARIOS, useWorkbench } from "@/lib/workbench-state";
import { MobileNav } from "@/components/wb/shell";
import { PipelineSpine } from "@/components/wb/pipeline";
import {
  EnvelopeCard,
  ExchangePanel,
  QlfPanel,
  RealityRecordPanel,
  ReductionPanel,
  SourcePanel,
  WhyPanel,
  WitnessPanel,
} from "@/components/wb/envelope";
import { GhostBtn, Panel, StatusTag } from "@/components/wb/primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { scenario, setScenario, reality, applicableMutations, mutation, setMutation } = useWorkbench();
  const meta = SCENARIOS.find((s) => s.id === scenario)!;

  return (
    <div className="grid gap-3">
      <MobileNav />
      <header className="rounded-xl border border-border bg-surface p-4">
        <p className="font-mono text-micro tracking-label text-primary">PROVENANCE COMPILER</p>
        <h1 className="mt-1 text-xl font-medium tracking-display sm:text-2xl">
          From capability to independently checkable evidence.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Originate a QuantumOS event, reduce the Rholang, record a block, observe it, then lie — and watch the first layer that breaks.
        </p>
      </header>

      <Panel title="Scenario" subtitle="The event the compiler will originate">
        <div className="grid gap-2 sm:grid-cols-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScenario(s.id)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors duration-(--motion-quick)",
                scenario === s.id ? "border-primary/50 bg-elevated" : "border-border bg-bg hover:border-border-strong",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{s.title}</span>
                {s.killer ? (
                  <span className="font-mono text-micro tracking-label text-evidence">KILLER DEMO</span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted">{s.summary}</p>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Counterfactual" subtitle="Mutate one fact, recompile, watch the first divergence">
        <div className="flex flex-wrap gap-2">
          {applicableMutations.map((m) => (
            <GhostBtn key={m.id} active={mutation === m.id} onClick={() => setMutation(m.id)}>
              {m.title}
            </GhostBtn>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">{applicableMutations.find((m) => m.id === mutation)?.summary}</p>
      </Panel>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Panel
          title="Compilation spine"
          subtitle={meta.title}
          right={<StatusTag status={reality.status} />}
        >
          <PipelineSpine />
        </Panel>
        <div className="grid gap-3">
          <RealityRecordPanel />
          <EnvelopeCard />
          <WitnessPanel />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <QlfPanel />
        <SourcePanel />
        <ReductionPanel />
        <ExchangePanel />
      </div>
      <WhyPanel />
    </div>
  );
}
