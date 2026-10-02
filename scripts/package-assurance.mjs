import { rmSync, mkdirSync, writeFileSync, copyFileSync, chmodSync } from "node:fs";
import { execFileSync } from "node:child_process";

const output = "dist/assurance-engine";
rmSync(output, { recursive: true, force: true });
execFileSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "-p", "tsconfig.assurance.json"],
  { stdio: "inherit" },
);
const manifest = {
  name: "@aixaria/assurance-engine",
  version: "0.3.0",
  description: "RCHAIN-COMPLIER reusable task-bound assurance and evidence engine",
  type: "module",
  license: "SEE LICENSE IN LICENSE",
  engines: { node: ">=22.18.0" },
  repository: { type: "git", url: "https://github.com/aixaria0/RCHAIN-COMPLIER.git" },
  bin: { assurance: "./lib/lib/assurance/cli.js" },
  exports: {
    ".": { types: "./lib/lib/assurance/index.d.ts", import: "./lib/lib/assurance/index.js" },
    "./lattice": { types: "./lib/lib/lattice/index.d.ts", import: "./lib/lib/lattice/index.js" },
    "./integrations/rchain": {
      types: "./lib/lib/integrations/rchain-c192.d.ts",
      import: "./lib/lib/integrations/rchain-c192.js",
    },
  },
  files: ["lib", "schemas", "README.md", "SECURITY.md", "LICENSE", "VERSIONING.md"],
};
writeFileSync(`${output}/package.json`, JSON.stringify(manifest, null, 2) + "\n");
for (const [source, target] of [
  ["docs/ASSURANCE_ENGINE.md", "README.md"],
  ["SECURITY.md", "SECURITY.md"],
  ["LICENSE", "LICENSE"],
  ["docs/ASSURANCE_VERSIONING.md", "VERSIONING.md"],
])
  copyFileSync(source, `${output}/${target}`);
mkdirSync(`${output}/schemas`, { recursive: true });
for (const name of [
  "intelligence-lattice-task-v1.schema.json",
  "intelligence-lattice-event-v1.json",
  "intelligence-lattice-policy-v1.json",
  "assurance-workload-v1.schema.json",
  "assurance-review-context-v1.schema.json",
  "assurance-report-v1.schema.json",
  "assurance-engine-state-v1.schema.json",
  "assurance-evidence-package-v1.schema.json",
])
  copyFileSync(`schemas/${name}`, `${output}/schemas/${name}`);
chmodSync(`${output}/lib/lib/assurance/cli.js`, 0o755);
process.stdout.write(`${output}\n`);
