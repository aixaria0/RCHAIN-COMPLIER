import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EvidenceRef, Severity, Status } from "@/lib/compiler";

export function StatusDot({ status, className }: { status: Status; className?: string }) {
  const tone =
    status === "PASS"
      ? "bg-pass"
      : status === "WARN"
        ? "bg-warn"
        : status === "FAIL"
          ? "bg-fail"
          : "bg-muted";
  return <span className={cn("inline-block size-1.5 shrink-0 rounded-full", tone, className)} aria-hidden />;
}

export function StatusTag({ status }: { status: Status }) {
  const tone =
    status === "PASS"
      ? "text-pass border-pass/40 bg-pass/10"
      : status === "WARN"
        ? "text-warn border-warn/40 bg-warn/10"
        : status === "FAIL"
          ? "text-fail border-fail/40 bg-fail/10"
          : "text-muted border-border bg-elevated";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-micro tracking-label", tone)}>
      <StatusDot status={status} />
      {status}
    </span>
  );
}

export function SeverityTag({ severity }: { severity: Severity }) {
  const tone =
    severity === "CRITICAL" ? "text-fail" : severity === "WARNING" ? "text-warn" : "text-muted";
  return <span className={cn("font-mono text-micro tracking-label", tone)}>{severity}</span>;
}

export function Panel({
  title,
  subtitle,
  right,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-surface p-2", className)}>
      <header className="flex items-start justify-between gap-3 rounded-lg px-2 py-2">
        <div>
          <h2 className="font-mono text-xxs tracking-label text-fg uppercase">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs leading-snug text-muted">{subtitle}</p> : null}
        </div>
        {right}
      </header>
      <div className="rounded-lg bg-bg/50 p-3">{children}</div>
    </section>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-xxs break-all text-fg", className)}>{children}</span>;
}

export function FieldRow({
  label,
  value,
  source,
  field,
  unavailable,
}: {
  label: string;
  value: string;
  source?: string;
  field?: string;
  unavailable?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border/60 py-1.5 last:border-b-0">
      <div className="min-w-32">
        <div className="text-xs text-muted">{label}</div>
        {source ? (
          <div className="font-mono text-micro text-evidence/90">
            {source}
            {field ? ` · ${field}` : ""}
          </div>
        ) : null}
      </div>
      <span className={cn("font-mono text-xxs break-all", unavailable ? "text-muted" : "text-fg")}>
        {unavailable ? "UNAVAILABLE" : value}
      </span>
    </div>
  );
}

export function EvidenceList({ evidence }: { evidence: EvidenceRef[] }) {
  if (!evidence.length) {
    return <p className="text-xs text-muted">No evidence records on this object.</p>;
  }
  return (
    <div className="overflow-hidden rounded-md border border-border bg-bg/70">
      <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_minmax(0,1fr)] border-b border-border bg-elevated px-2 py-1 font-mono text-micro tracking-label text-muted">
        <span>SOURCE</span>
        <span>FIELD</span>
        <span>VALUE</span>
      </div>
      <div className="max-h-64 overflow-auto">
        {evidence.map((e, i) => (
          <div
            key={`${e.field}-${i}`}
            className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_minmax(0,1fr)] gap-x-2 border-b border-border/40 px-2 py-1 font-mono text-xxs last:border-b-0"
          >
            <span className="text-evidence">{e.source}</span>
            <span className="break-all text-muted">{e.field}</span>
            <span className={cn("break-all", e.value === "UNAVAILABLE" || e.value === "ABSENT" ? "text-muted" : "text-fg")}>
              {e.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Expandable({
  header,
  children,
  defaultOpen = false,
}: {
  header: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/60 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center gap-2 py-1.5 text-left transition-colors duration-(--motion-quick) hover:bg-elevated/40"
      >
        <ChevronRight className={cn("size-3.5 shrink-0 text-muted transition-transform duration-(--motion-quick)", open && "rotate-90")} />
        <div className="min-w-0 flex-1">{header}</div>
      </button>
      {open ? <div className="pb-2 pl-6">{children}</div> : null}
    </div>
  );
}

export function GhostBtn({
  children,
  onClick,
  active,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-md border px-3 py-1.5 text-left font-mono text-xxs leading-snug text-fg transition-[background-color,border-color,transform] duration-(--motion-quick) ease-[var(--ease-smooth-out)] active:scale-[0.96]",
        active ? "border-primary/50 bg-elevated text-fg" : "border-border bg-surface hover:border-border-strong hover:bg-elevated",
        className,
      )}
    >
      {children}
    </button>
  );
}
