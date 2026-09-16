import { LAYERS, type LayerId } from "@/lib/compiler";
import { LAYER_ORDER, useWorkbench } from "@/lib/workbench-state";
import { cn } from "@/lib/utils";
import { StatusTag } from "./primitives";
import type { Reality, Status } from "@/lib/compiler";

function pick(reality: Reality, id: LayerId): Status {
  const inv = reality.invariants.filter((i) => i.layer === id);
  if (!inv.length) {
    if (id === "rholang" || id === "rchain") {
      return reality.execution ? "PASS" : "UNAVAILABLE";
    }
    if (id === "block") return reality.blocks.length ? "PASS" : "UNAVAILABLE";
    if (id === "verification") return reality.status;
    return "UNAVAILABLE";
  }
  if (inv.some((i) => i.status === "FAIL")) return "FAIL";
  if (inv.some((i) => i.status === "WARN")) return "WARN";
  if (inv.every((i) => i.status === "UNAVAILABLE")) return "UNAVAILABLE";
  return "PASS";
}

export function PipelineSpine() {
  const { reality, playhead, envelope, setSelectedEnvelope } = useWorkbench();

  return (
    <ol className="flex flex-col">
      {LAYERS.map((layer, i) => {
        const visible = playhead > i;
        const status = pick(reality, layer.id);
        const env = reality.envelopes.find((e) => e.layer === layer.id);
        const active = envelope?.layer === layer.id;
        return (
          <li key={layer.id} className={cn(!visible && playhead < LAYER_ORDER.length ? "opacity-25" : "rise-in")}>
            <button
              type="button"
              onClick={() => env && setSelectedEnvelope(env.eventId)}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-[border-color,background-color] duration-(--motion-fast) ease-[var(--ease-smooth-out)]",
                active ? "border-primary/50 bg-elevated" : "border-border bg-surface hover:border-border-strong",
              )}
            >
              <span className="mt-0.5 font-mono text-micro tabular-nums text-muted">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{layer.label}</span>
                  <StatusTag status={status} />
                </div>
                <p className="mt-0.5 text-xs text-muted">{layer.role}</p>
              </div>
            </button>
            {i < LAYERS.length - 1 ? (
              <svg className="h-5 w-full" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden>
                <line
                  x1="18"
                  y1="0"
                  x2="18"
                  y2="20"
                  className="flow-line"
                  stroke="currentColor"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                  style={{ color: "var(--color-border-strong)" }}
                />
              </svg>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
