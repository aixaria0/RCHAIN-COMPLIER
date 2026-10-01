import { AETHERFORGE_FROZEN_SNAPSHOT } from "../src/lib/subjects/aetherforge.ts";
import { repairAetherForgeSnapshot } from "../src/lib/subjects/aetherforge-repair.ts";

const tampered = structuredClone(AETHERFORGE_FROZEN_SNAPSHOT);
tampered.bounce[0]!.rho *= 2;

const result = repairAetherForgeSnapshot(tampered);
console.log(JSON.stringify(result, null, 2));
