import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  compile,
  compileRealityRecord,
  diffReality,
  MUTATIONS,
  SCENARIOS,
  type EventEnvelope,
  type LayerId,
  type MutationId,
  type Reality,
  type RealityDiff,
  type RealityRecord,
  type ScenarioId,
} from "@/lib/compiler";

interface WorkbenchValue {
  scenario: ScenarioId;
  setScenario: (id: ScenarioId) => void;
  mutation: MutationId;
  setMutation: (id: MutationId) => void;
  reality: Reality;
  realityRecord: RealityRecord;
  baseline: Reality;
  diff: RealityDiff;
  selectedEnvelope: string;
  setSelectedEnvelope: (id: string) => void;
  envelope: EventEnvelope;
  playhead: number;
  playing: boolean;
  replayCompile: () => void;
  reset: () => void;
  applicableMutations: typeof MUTATIONS;
}

const WorkbenchContext = createContext<WorkbenchValue | null>(null);

const LAYER_ORDER: LayerId[] = [
  "quantumos",
  "qlf",
  "rholang",
  "rspace",
  "rchain",
  "block",
  "sentinel",
  "lattice",
  "verification",
];

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const [scenario, setScenario] = useState<ScenarioId>("exchange-commit");
  const [mutation, setMutation] = useState<MutationId>("none");
  const [selectedEnvelope, setSelectedEnvelope] = useState("evt");
  const [playhead, setPlayhead] = useState(LAYER_ORDER.length);
  const [playing, setPlaying] = useState(true);
  const [nonce, setNonce] = useState(0);

  const applicableMutations = useMemo(
    () => MUTATIONS.filter((m) => m.applies.includes(scenario)),
    [scenario],
  );

  useEffect(() => {
    if (!applicableMutations.some((m) => m.id === mutation)) {
      setMutation("none");
    }
  }, [applicableMutations, mutation]);

  const reality = useMemo(() => compile(scenario, mutation), [scenario, mutation, nonce]);
  const realityRecord = useMemo(
    () => compileRealityRecord(scenario, mutation),
    [scenario, mutation, nonce],
  );
  const baseline = useMemo(() => compile(scenario, "none"), [scenario]);
  const diff = useMemo(() => diffReality(baseline, reality), [baseline, reality]);

  useEffect(() => {
    const first = reality.envelopes[0];
    if (first) setSelectedEnvelope(first.eventId);
    setPlayhead(0);
    setPlaying(true);
  }, [reality]);

  useEffect(() => {
    if (!playing) return;
    if (playhead >= LAYER_ORDER.length) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => setPlayhead((p) => p + 1), 220);
    return () => window.clearTimeout(t);
  }, [playing, playhead]);

  const envelope =
    reality.envelopes.find((e) => e.eventId === selectedEnvelope) ?? reality.envelopes[0]!;

  const value: WorkbenchValue = {
    scenario,
    setScenario: (id) => {
      setScenario(id);
    },
    mutation,
    setMutation,
    reality,
    realityRecord,
    baseline,
    diff,
    selectedEnvelope,
    setSelectedEnvelope,
    envelope,
    playhead,
    playing,
    replayCompile: () => setNonce((n) => n + 1),
    reset: () => {
      setMutation("none");
      setNonce((n) => n + 1);
    },
    applicableMutations,
  };

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>;
}

export function useWorkbench() {
  const ctx = useContext(WorkbenchContext);
  if (!ctx) throw new Error("useWorkbench must be used inside WorkbenchProvider");
  return ctx;
}

export { SCENARIOS, MUTATIONS, LAYER_ORDER };
