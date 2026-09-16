import { createFileRoute } from "@tanstack/react-router";
import { shortHex } from "@/lib/compiler";
import { useWorkbench } from "@/lib/workbench-state";
import { MobileNav } from "@/components/wb/shell";
import { FieldRow, Panel, StatusTag } from "@/components/wb/primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/replay")({
  component: Replay,
});

function Replay() {
  const { reality, baseline, diff, mutation } = useWorkbench();
  const replay = reality.replay;
  return (
    <div className="grid gap-3">
      <MobileNav />
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Observed execution" subtitle="State hash recorded on the block" right={<StatusTag status={baseline.status} />}>
          <FieldRow
            label="state hash"
            value={baseline.execution?.stateHash ?? "UNAVAILABLE"}
            unavailable={!baseline.execution}
            source="ExecutionTrace"
            field="state_hash"
          />
          <FieldRow
            label="trace hash"
            value={baseline.execution?.traceHash ?? "UNAVAILABLE"}
            unavailable={!baseline.execution}
          />
          <FieldRow label="steps" value={String(baseline.execution?.steps.length ?? 0)} />
          <ol className="mt-3 max-h-72 space-y-1 overflow-auto">
            {(baseline.execution?.steps ?? []).map((s) => (
              <li key={s.n} className="flex gap-2 font-mono text-xxs">
                <span className="tabular-nums text-muted">{s.n}</span>
                <span className="w-12 text-primary">{s.rule}</span>
                <span className="text-fg">{s.description}</span>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel
          title="Local replay"
          subtitle="Reducer re-run against the same process"
          right={<StatusTag status={replay?.match ? "PASS" : replay ? "FAIL" : "UNAVAILABLE"} />}
        >
          {replay ? (
            <>
              <FieldRow label="expected" value={replay.expectedStateHash} source="Replay" field="expected_state_hash" />
              <FieldRow label="observed" value={replay.observedStateHash} source="Replay" field="observed_state_hash" />
              <FieldRow label="match" value={String(replay.match)} />
              {replay.firstDivergence ? (
                <div className="mt-3 rounded-md border border-fail/40 bg-fail/10 p-3">
                  <p className="font-mono text-micro tracking-label text-fail">EXECUTION DIVERGENCE</p>
                  <FieldRow label="step" value={String(replay.firstDivergence.step)} />
                  <FieldRow label="object" value={replay.firstDivergence.object} />
                  <FieldRow label="expected" value={replay.firstDivergence.expected} />
                  <FieldRow label="observed" value={replay.firstDivergence.observed} />
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted">Replay matches the observed post-state hash.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">UNAVAILABLE — no execution to replay.</p>
          )}
        </Panel>
      </div>

      <Panel title="Reality diff" subtitle={`${mutation === "none" ? "Baseline vs itself" : `Baseline vs ${mutation}`}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-xs">
            <thead className="font-mono text-micro tracking-label text-muted">
              <tr className="border-b border-border">
                <th className="py-2 pr-3">LAYER</th>
                <th className="py-2 pr-3">FIELD</th>
                <th className="py-2 pr-3">RUN A</th>
                <th className="py-2 pr-3">RUN B</th>
                <th className="py-2">Δ</th>
              </tr>
            </thead>
            <tbody>
              {diff.rows.map((r) => (
                <tr
                  key={`${r.layer}.${r.field}`}
                  className={cn("border-b border-border/50", r.diverged && "bg-fail/8")}
                >
                  <td className="py-2 pr-3 font-mono text-micro text-primary">{r.layer}</td>
                  <td className="py-2 pr-3 font-mono text-xxs">{r.field}</td>
                  <td className="max-w-48 truncate py-2 pr-3 font-mono text-xxs" title={r.a}>
                    {r.a.startsWith("0x") ? shortHex(r.a) : r.a}
                  </td>
                  <td className="max-w-48 truncate py-2 pr-3 font-mono text-xxs" title={r.b}>
                    {r.b.startsWith("0x") ? shortHex(r.b) : r.b}
                  </td>
                  <td className={cn("py-2 font-mono text-micro", r.diverged ? "text-fail" : "text-muted")}>
                    {r.diverged ? "DIFF" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {diff.first ? (
          <p className="mt-3 text-sm text-muted">
            Divergence at <span className="text-fg">{diff.first.layer}.{diff.first.field}</span>
            {" — "}
            {diff.downstream.length} downstream field{diff.downstream.length === 1 ? "" : "s"} changed.
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted">Runs are identical under the current mutation.</p>
        )}
      </Panel>
    </div>
  );
}
