import { Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  GitCompareArrows,
  Network,
  RotateCcw,
  SplitSquareHorizontal,
  Boxes,
  Workflow,
  ShieldAlert,
  Play,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useWorkbench } from "@/lib/workbench-state";
import { StatusTag } from "./primitives";

const NAV = [
  { to: "/", label: "Compiler", icon: Activity },
  { to: "/causality", label: "Causality", icon: Workflow },
  { to: "/counterfactual", label: "Counterfactual", icon: ShieldAlert },
  { to: "/replay", label: "Replay / Diff", icon: GitCompareArrows },
  { to: "/evidence", label: "Evidence", icon: Network },
  { to: "/architecture", label: "Architecture", icon: Boxes },
] as const;

function Banner() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-evidence/25 bg-evidence/8 px-3 py-1.5 sm:px-4">
      <span className="font-mono text-micro tracking-label text-evidence">LOCAL COMPILER</span>
      <span className="hidden font-mono text-micro tracking-label text-evidence/80 md:inline">
        IN-BROWSER ENGINE — NOT LIVE RCHAIN EVIDENCE
      </span>
      <span className="font-mono text-micro tracking-label text-evidence/80 md:hidden">NOT LIVE EVIDENCE</span>
      <span className="inline-flex items-center gap-1.5 font-mono text-micro tracking-label text-primary sm:ml-auto">
        <span className="size-1.5 rounded-full bg-primary pulse-node" />
        EVIDENCE-FIRST
      </span>
    </div>
  );
}

function ControlBar() {
  const { mutation, reset, replayCompile, reality } = useWorkbench();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-2 border-b border-border bg-surface/80 px-3 py-2 sm:px-4 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-micro tracking-label text-muted">RESULT</span>
        <StatusTag status={reality.status} />
        <span className={cn("font-mono text-xxs", mutation === "none" ? "text-muted" : "text-warn")}>
          {mutation === "none" ? "BASELINE" : mutation.replaceAll("-", " ").toUpperCase()}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:ml-auto">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-border bg-elevated px-2.5 font-mono text-micro tracking-label transition-colors duration-(--motion-quick) hover:border-border-strong"
        >
          <RotateCcw className="size-3.5" /> RESET
        </button>
        <button
          type="button"
          onClick={replayCompile}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-border bg-elevated px-2.5 font-mono text-micro tracking-label transition-colors duration-(--motion-quick) hover:border-border-strong"
        >
          <Play className="size-3.5" /> RECOMPILE
        </button>
        <button
          type="button"
          onClick={() => navigate({ to: "/counterfactual" })}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-border bg-elevated px-2.5 font-mono text-micro tracking-label transition-colors duration-(--motion-quick) hover:border-border-strong"
        >
          <ShieldAlert className="size-3.5" /> WHAT IF
        </button>
        <button
          type="button"
          onClick={() => navigate({ to: "/replay" })}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary px-2.5 font-mono text-micro tracking-label text-primary-fg transition-colors duration-(--motion-quick) hover:opacity-90"
        >
          <SplitSquareHorizontal className="size-3.5" /> DIFF
        </button>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-bg text-fg">
      <Banner />
      <div className="flex min-h-[calc(100vh-2rem)]">
        <aside className="hidden w-56 shrink-0 border-r border-border bg-surface md:block">
          <div className="border-b border-border px-4 py-4">
            <div className="font-mono text-micro tracking-label text-primary">RCHAIN</div>
            <div className="text-base font-medium leading-tight">Reality Compiler</div>
            <div className="mt-1 font-mono text-micro tracking-label text-muted">
              CAPABILITY → EVIDENCE
            </div>
          </div>
          <nav className="p-2">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="group flex min-h-11 items-center gap-2 rounded-md border-l-2 border-transparent px-2 text-sm text-muted transition-colors duration-(--motion-quick) hover:bg-elevated/60 hover:text-fg data-[status=active]:border-l-primary data-[status=active]:bg-elevated data-[status=active]:text-fg"
              >
                <item.icon className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="mx-3 mt-3 rounded-lg border border-border p-3">
            <p className="text-xs leading-snug text-muted">
              Each layer states only its own claim. Observed agreement is not Casper finality.
              Lattice certificates are not RChain Casper.
            </p>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <ControlBar />
          <div className="grid-backdrop min-h-full p-3 sm:p-4">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function MobileNav() {
  return (
    <nav className="mb-3 flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1 md:hidden">
      {NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.to === "/" }}
          className="shrink-0 rounded-md px-3 py-2 font-mono text-micro tracking-label text-muted data-[status=active]:bg-elevated data-[status=active]:text-fg"
        >
          {item.label.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}
