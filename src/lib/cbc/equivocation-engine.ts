import { digest } from "../compiler/hash.ts";
import type { ValidatorState, ValidatorEvent } from "./validator.ts";

export interface CbcEquivocation {
  validator: string;
  round: number;
  propositions: string[];
  evidence: string[];
}

export function equivocate(
  validator: ValidatorState,
  round: number,
  propositions: string[],
): ValidatorEvent[] {
  return propositions.map((proposition) => {
    validator.currentJustification = proposition;
    return {
      round,
      validator: validator.id,
      kind: "EQUIVOCATE" as const,
      proposition,
      digest: digest([round, validator.id, "EQUIVOCATE", proposition]),
    };
  });
}

export function detectEquivocations(events: ValidatorEvent[]): CbcEquivocation[] {
  const grouped = new Map<string, ValidatorEvent[]>();
  for (const event of events) {
    if (event.kind !== "EQUIVOCATE") continue;
    const key = `${event.round}|${event.validator}`;
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([key, sourceEvents]) => {
      const propositions = [...new Set(sourceEvents.map((event) => event.proposition))].sort();
      if (propositions.length < 2) return [];
      const [round, validator] = key.split("|");
      return [{
        validator,
        round: Number(round),
        propositions,
        evidence: sourceEvents.map((event) => event.digest).sort(),
      }];
    });
}
