/** Verify the shipped tarball in a clean consumer; no repository modules or runtime npm dependencies. */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const directory = mkdtempSync(join(tmpdir(), "assurance-consumer-"));
const tarball = resolve(
  "dist",
  readdirSync("dist").find((file) => /^aixaria-assurance-engine-.*\.tgz$/.test(file)) ?? "missing",
);
const run = (args, options = {}) =>
  execFileSync(process.execPath, args, {
    cwd: directory,
    encoding: "utf8",
    timeout: 30000,
    ...options,
  });
try {
  writeFileSync(join(directory, "package.json"), '{"type":"module","private":true}\n');
  execFileSync(
    npm,
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--offline", tarball],
    { cwd: directory, stdio: "pipe", timeout: 30000 },
  );
  const packageRoot = join(directory, "node_modules/@aixaria/assurance-engine");
  const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  assert.equal(manifest.dependencies, undefined);
  const cli = join(packageRoot, manifest.bin.assurance),
    demo = join(directory, "demo");
  run([cli, "--help"]);
  const summary = JSON.parse(run([cli, "demo", demo]).trim());
  assert.ok(Object.values(summary.checks).every(Boolean));
  const report = JSON.parse(
    run([
      cli,
      "verify",
      join(demo, "sample.evidence.ndjson"),
      join(demo, "sample.trust.json"),
    ]).trim(),
  );
  assert.equal(report.status, "PASS");
  const status = JSON.parse(run([cli, "status", join(demo, "engine")]).trim());
  assert.equal(status.journals.length, 3);
  try {
    run([cli, "verify", join(demo, "tampered.evidence.ndjson"), join(demo, "sample.trust.json")]);
    assert.fail("tamper accepted");
  } catch (error) {
    assert.equal(error.status, 1);
  }
  const consumer = join(directory, "consumer.mjs");
  writeFileSync(
    consumer,
    `import {verifyEvidence, canonical} from '@aixaria/assurance-engine';
    import {startNode} from '@aixaria/assurance-engine/lattice';
    import {RCHAIN_VERIFIERS} from '@aixaria/assurance-engine/integrations/rchain';
    import {readFileSync} from 'node:fs';
    const trust = JSON.parse(readFileSync(process.argv[3]));
    if(verifyEvidence(readFileSync(process.argv[2]),trust).status!=='PASS' || typeof startNode!=='function'
      || !RCHAIN_VERIFIERS.has('rchain-c192-upstream/v1') || canonical({b:2,a:1})!=='{"a":1,"b":2}') process.exit(1);
  `,
  );
  run([consumer, join(demo, "sample.evidence.ndjson"), join(demo, "sample.trust.json")]);
  // Verify declarations as a real NodeNext TypeScript consumer, including a negative type assertion.
  writeFileSync(
    join(directory, "consumer.ts"),
    `import {type Workload, type VerificationReport, verifyEvidence, AssuranceEngine} from '@aixaria/assurance-engine';
    const input: Workload = {schema:'assurance-workload/v1',domain:'arithmetic',operation:'integer-sum/v1',predicate:'integer-sum',input:null,value:0};
    // @ts-expect-error public workload must not silently become any
    input.nonexistent;
    const verify: (bytes:Uint8Array, context:{expectedPolicyDigest:string;expectedTaskId:string;expectedClaimId:string})=>VerificationReport = verifyEvidence;
    const open:typeof AssuranceEngine.open = AssuranceEngine.open;
    void verify; void open;
  `,
  );
  writeFileSync(
    join(directory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
        types: ["node"],
        typeRoots: [resolve("node_modules/@types")],
      },
      include: ["consumer.ts"],
    }),
  );
  run([resolve("node_modules/typescript/bin/tsc"), "-p", join(directory, "tsconfig.json")]);
  // A killed supervisor must release the OS-backed lock and its three children must exit on IPC disconnect.
  const service = spawn(process.execPath, [cli, "serve", join(demo, "engine")], {
    cwd: directory,
    stdio: ["ignore", "pipe", "ignore"],
  });
  await new Promise((res, rej) => {
    const timer = setTimeout(() => {
      service.kill("SIGKILL");
      rej(new Error("service readiness timeout"));
    }, 15000);
    service.once("error", (error) => {
      clearTimeout(timer);
      rej(error);
    });
    service.once("exit", () => {
      clearTimeout(timer);
      rej(new Error("service exited before readiness"));
    });
    service.stdout.once("data", () => {
      clearTimeout(timer);
      res();
    });
  });
  await new Promise((res) => {
    service.once("exit", res);
    service.kill("SIGKILL");
  });
  const resumed = JSON.parse(
    run([
      cli,
      "run",
      join(demo, "engine"),
      join(demo, "workload.json"),
      join(demo, "after-kill"),
    ]).trim(),
  );
  assert.equal(resumed.status, "PASS");
  assert.equal(resumed.claimId, report.claimId);
  process.stdout.write(
    JSON.stringify({
      schema: "assurance-install-check/v1",
      status: "PASS",
      tarball,
      checks: [
        "offline-install",
        "no-runtime-dependencies",
        "compiled-three-process-demo",
        "independent-verification",
        "tamper-exit",
        "sdk-exports",
        "typescript-consumer",
        "supervisor-kill-recovery",
      ],
    }) + "\n",
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
