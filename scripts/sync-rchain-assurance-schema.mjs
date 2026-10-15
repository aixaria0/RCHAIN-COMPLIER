import { readFileSync, writeFileSync } from "node:fs";
const schema = JSON.parse(readFileSync("contracts/rchain-assurance/v1.schema.json", "utf8"));
const generated = '// Generated from contracts/rchain-assurance/v1.schema.json; do not edit.\nexport const rchainAssuranceSchema = ' + JSON.stringify(schema, null, 2) + ' as const;\n';
const target = "src/lib/assurance/rchain-assurance-schema.ts";
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== generated) throw new Error("Canonical schema generation is stale");
} else writeFileSync(target, generated);
