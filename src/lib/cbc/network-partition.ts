import type { ValidatorId } from "./validator.ts";

export interface NetworkPartition {
  groups: ValidatorId[][];
  delayedRounds: number;
  reorder: boolean;
}

export interface Delivery {
  from: ValidatorId;
  to: ValidatorId;
  proposition: string;
  availableRound: number;
}

export function partitionValidators(ids: ValidatorId[], split: number, delayedRounds = 0): NetworkPartition {
  if (split <= 0 || split >= ids.length) throw new Error("split must create two non-empty groups");
  return {
    groups: [ids.slice(0, split), ids.slice(split)],
    delayedRounds,
    reorder: false,
  };
}

export function schedulePartitionedDelivery(
  partition: NetworkPartition,
  round: number,
  proposition: string,
): Delivery[] {
  const deliveries: Delivery[] = [];
  for (const [groupIndex, group] of partition.groups.entries()) {
    const other = partition.groups[1 - groupIndex] ?? [];
    for (const from of group) {
      for (const to of other) {
        deliveries.push({
          from,
          to,
          proposition,
          availableRound: round + partition.delayedRounds + 1,
        });
      }
    }
  }
  return partition.reorder
    ? deliveries.reverse()
    : deliveries.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
}
