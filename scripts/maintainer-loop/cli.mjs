#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { getScenario, SCENARIOS } from "./scenarios.mjs";
import { runScenario } from "./core.mjs";

function argsOf(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--list") args.list = true;
    else if (token === "--scenario") args.scenario = argv[++i];
    else if (token === "--input") args.input = argv[++i];
    else if (token === "--out") args.out = argv[++i];
    else if (token === "--previous-digest") args.previousDigest = argv[++i];
    else throw new Error(`unknown argument: ${token}`);
  }
  return args;
}

const args = argsOf(process.argv);

if (args.list) {
  for (const scenario of Object.values(SCENARIOS)) {
    console.log(`${scenario.id}\t${scenario.label}`);
  }
  process.exit(0);
}

if (!args.scenario || !args.input) {
  console.error("usage: node scripts/maintainer-loop/cli.mjs --scenario <ID> --input <evidence.json> [--out record.json]");
  process.exit(2);
}

const scenario = getScenario(args.scenario);
const input = JSON.parse(await readFile(args.input, "utf8"));
const result = runScenario({ scenario, input, previousDigest: args.previousDigest });

if (args.out) {
  await writeFile(args.out, JSON.stringify(result.record, null, 2) + "\n");
}

console.log(JSON.stringify({
  scenario: result.scenario,
  state: result.state,
  firstDivergence: result.firstDivergence,
  recordDigest: result.record.integrity.recordDigest,
  output: args.out ?? null,
}, null, 2));

process.exit(result.state === "DIVERGENT" ? 1 : result.state === "INCOMPLETE" ? 2 : 0);
