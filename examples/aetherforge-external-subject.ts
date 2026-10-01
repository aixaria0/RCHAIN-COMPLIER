import { compileVerification } from "../src/lib/compiler/verification-compiler.ts";
import {
  createAetherForgeAdapter,
  createAetherForgeProblem,
} from "../src/lib/subjects/aetherforge.ts";

const result = compileVerification(createAetherForgeProblem(), [createAetherForgeAdapter()]);
console.log(JSON.stringify(result, null, 2));
