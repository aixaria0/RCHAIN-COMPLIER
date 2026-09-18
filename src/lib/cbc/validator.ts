import { digest } from "../compiler/hash.ts";

export type ValidatorId = string;

export interface ValidatorState {
  id: ValidatorId;
  honest: boolean;
  currentJustification: string;
  received: string[];
  emitted: string[];
}

export interface ValidatorEvent {
  round: number;
  validator: ValidatorId;
  kind: "JUSTIFY" | "RECEIVE" | "EQUIVOCATE";
  proposition: string;
  digest: string;
}

export function createValidators(count: number, byzantine = 0): ValidatorState[] {
  if (!Number.isInteger(count) || count < 1) throw new Error("validator count must be positive");
  if (!Number.isInteger(byzantine) || byzantine < 0 || byzantine > count) throw new Error("invalid byzantine count");
  return Array.from({ length: count }, (_, index) => ({
    id: `v${index}`,
    honest: index >= byzantine,
    currentJustification: "genesis",
    received: [],
    emitted: [],
  }));
}

export function validatorEvent(
  round: number,
  validator: ValidatorState,
  proposition: string,
  kind: ValidatorEvent["kind"] = "JUSTIFY",
): ValidatorEvent {
  const event = {
    round,
    validator: validator.id,
    kind,
    proposition,
    digest: digest([round, validator.id, kind, proposition]),
  };
  validator.emitted.push(event.digest);
  if (kind === "JUSTIFY") validator.currentJustification = proposition;
  return event;
}
