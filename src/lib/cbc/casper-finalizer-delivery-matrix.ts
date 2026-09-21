import { traceCasperFinalizerObservation, type CasperFinalizerObservation, type CasperFinalizerTrace } from "./casper-finalizer-observation.ts";

export type DeliveryFault = "NONE" | "PARTITIONED_OBSERVER" | "MISSING_MINIMUM_SENDER" | "REORDER_ONLY";

export interface FinalizerDeliveryCase {
  name: string;
  fault: DeliveryFault;
  observation: CasperFinalizerObservation;
}

export interface FinalizerDeliveryResult extends CasperFinalizerTrace {
  name: string;
  fault: DeliveryFault;
}

export function runFinalizerDeliveryMatrix(
  cases: FinalizerDeliveryCase[],
): FinalizerDeliveryResult[] {
  return cases.map(({ name, fault, observation }) => ({
    name,
    fault,
    ...traceCasperFinalizerObservation(observation),
  }));
}

export function defaultFinalizerDeliveryMatrix(): FinalizerDeliveryCase[] {
  const bonds = { v0: 70, v1: 10, v2: 10, v3: 10 };
  const minimum = ["v0", "v1", "v2", "v3"];

  return [
    {
      name: "all-delivered",
      fault: "NONE",
      observation: {
        bondsMap: bonds,
        minimumMessageSenders: minimum,
        supportObservers: { v0: ["v0", "v1", "v2", "v3"] },
      },
    },
    {
      name: "observer-partition",
      fault: "PARTITIONED_OBSERVER",
      observation: {
        bondsMap: bonds,
        minimumMessageSenders: minimum,
        supportObservers: { v0: ["v0", "v1", "v2"] },
      },
    },
    {
      name: "missing-minimum-sender",
      fault: "MISSING_MINIMUM_SENDER",
      observation: {
        bondsMap: bonds,
        minimumMessageSenders: ["v0", "v1", "v2"],
        supportObservers: { v0: ["v0", "v1", "v2", "v3"] },
      },
    },
    {
      name: "reordered-but-complete",
      fault: "REORDER_ONLY",
      observation: {
        bondsMap: bonds,
        minimumMessageSenders: ["v3", "v1", "v0", "v2"],
        supportObservers: { v0: ["v3", "v2", "v1", "v0"] },
      },
    },
  ];
}
