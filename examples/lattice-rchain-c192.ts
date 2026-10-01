import assert from "node:assert/strict";
import { fork, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  artifactDigest,
  canonical,
  createEvent,
  EVENT_KINDS,
  exact,
  generateIdentity,
  parseCanonical,
  type EventBody,
  type Identity,
  type Json,
  type LatticeEvent,
  type MembershipPolicy,
} from "../src/lib/lattice/protocol.ts";
import { replay } from "../src/lib/lattice/replay.ts";

const VERIFIER = "rchain-c192-upstream/v1";
const PREDICATE = "c192-upstream-falsifier-passes";

async function view(url: string) {
  const r = await fetch(url + "/view", { signal: AbortSignal.timeout(5000) });
  assert.equal(r.status, 200);
  return (await r.json()) as ReturnType<typeof replay>;
}
async function events(url: string) {
  const result: LatticeEvent[] = [];
  let after = 0,
    ceiling: number | undefined;
  while (true) {
    const r = await fetch(
      `${url}/events?after=${after}${ceiling === undefined ? "" : "&ceiling=" + ceiling}`,
      { signal: AbortSignal.timeout(5000) },
    );
    assert.equal(r.status, 200);
    const lines = (await r.text()).trimEnd().split("\n"),
      h = parseCanonical(lines.shift()!) as {
        nextCursor: number;
        ceiling: number;
        hasMore: boolean;
      };
    result.push(...lines.filter(Boolean).map((line) => parseCanonical(line) as LatticeEvent));
    after = h.nextCursor;
    ceiling = h.ceiling;
    if (!h.hasMore) return result;
  }
}
async function launch(file: string): Promise<{ child: ChildProcess; url: string }> {
  const child = fork(
    fileURLToPath(new URL("../src/lib/lattice/node.ts", import.meta.url)),
    [file],
    { execArgv: ["--experimental-strip-types"], stdio: ["ignore", "pipe", "pipe", "ipc"] },
  );
  let diagnostics = "";
  child.stdout!.resume();
  child.stderr!.on("data", (value) => {
    diagnostics = (diagnostics + String(value)).slice(-2000);
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("readiness timeout: " + diagnostics));
    }, 10000);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`node exited ${code}: ${diagnostics}`));
    });
    child.once("message", (message) => {
      clearTimeout(timer);
      const ready = message as { url: string };
      assert.ok(ready.url.startsWith("http://127.0.0.1:"));
      resolve({ child, url: ready.url });
    });
  });
}
async function stop(child: ChildProcess, signal: NodeJS.Signals = "SIGTERM") {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit"),
    timer = setTimeout(() => child.kill("SIGKILL"), 2000);
  child.kill(signal);
  try {
    await exited;
  } finally {
    clearTimeout(timer);
  }
}
function inspectWitness(input: Json) {
  const value = exact(input, [
    "schema",
    "repository",
    "revision",
    "issue",
    "finding",
    "sourcePath",
    "evidencePath",
    "testName",
    "command",
    "exitCode",
    "testPassed",
    "sourceSha256",
    "evidenceSha256",
    "outputSha256",
    "runUrl",
  ]);
  if (
    value.schema !== "rchain-c192-upstream-witness/v1" ||
    value.repository !== "rchain-community/rchain-rust" ||
    typeof value.revision !== "string" ||
    value.issue !== 172 ||
    value.finding !== "C192"
  )
    throw new Error("unexpected C192 witness");
  return { revision: value.revision };
}

export async function runC192Lifecycle(witnessPath: string) {
  const witness = JSON.parse(await readFile(witnessPath, "utf8")) as Json,
    { revision } = inspectWitness(witness),
    directory = await mkdtemp(join(tmpdir(), "lattice-rchain-c192-")),
    a = generateIdentity(),
    b = generateIdentity(),
    c = generateIdentity(),
    policy: MembershipPolicy = {
      schema: "intelligence-lattice-policy/v1",
      latticeId: "rchain-c192-live-witness",
      members: [a, b, c].map((identity) => ({
        actorId: identity.actorId,
        publicKeyHex: identity.publicKeyHex,
        kinds: [...EVENT_KINDS],
        domains: ["rchain-casper"],
      })),
    },
    configA = join(directory, "a.json"),
    configB = join(directory, "b.json"),
    configC = join(directory, "c.json");
  let left: Awaited<ReturnType<typeof launch>> | undefined,
    right: Awaited<ReturnType<typeof launch>> | undefined,
    third: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    for (const [name, identity] of [
      ["a", a],
      ["b", b],
      ["c", c],
    ] as const)
      await writeFile(
        join(directory, name + ".pem"),
        identity.privateKey.export({ type: "pkcs8", format: "pem" }),
        { mode: 0o600 },
      );

    const cfgA = {
      directory: join(directory, "a"),
      policy,
      keyFile: join(directory, "a.pem"),
      worker: false,
      port: 0,
    };
    await writeFile(configA, JSON.stringify(cfgA));
    left = await launch(configA);
    cfgA.port = Number(new URL(left.url).port);
    await writeFile(configA, JSON.stringify(cfgA));
    await writeFile(
      configB,
      JSON.stringify({
        directory: join(directory, "b"),
        policy,
        keyFile: join(directory, "b.pem"),
        worker: true,
        peers: [left.url],
        port: 0,
      }),
    );
    right = await launch(configB);
    await writeFile(
      configC,
      JSON.stringify({
        directory: join(directory, "c"),
        policy,
        keyFile: join(directory, "c.pem"),
        worker: true,
        peers: [left.url],
        port: 0,
      }),
    );
    third = await launch(configC);

    const urlA = left.url,
      urlB = right.url,
      urlC = third.url;
    assert.notEqual(left.child.pid, right.child.pid);
    assert.notEqual(left.child.pid, third.child.pid);
    assert.notEqual(right.child.pid, third.child.pid);

    async function submit(
      url: string,
      identity: Identity,
      body: EventBody,
      parents: readonly string[] = [],
    ) {
      const prior = await events(url),
        sequence =
          Math.max(0, ...prior.filter((event) => event.actorId === identity.actorId).map((event) => event.sequence)) + 1,
        event = createEvent(identity, policy, { sequence, body, parents: [...parents] });
      const r = await fetch(url + "/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: canonical(event),
        signal: AbortSignal.timeout(5000),
      });
      assert.equal(r.status, 200, await r.text());
      return event;
    }
    async function sync(url: string) {
      const r = await fetch(url + "/sync", { method: "POST", signal: AbortSignal.timeout(15000) });
      assert.equal(r.status, 200, await r.text());
    }

    const subject = artifactDigest(witness),
      task = await submit(urlA, a, {
        kind: "task",
        envelope: {
          schema: "intelligence-lattice-task/v1",
          taskId: artifactDigest({ purpose: "verify unresolved RChain C192 witness", revision }),
          domain: "rchain-casper",
          operation: VERIFIER,
          input: { digest: subject, mediaType: "application/json", content: witness },
          dependencies: [],
          authority: { mode: "observe-only", issuer: a.actorId },
          output: { mediaType: "application/json", claimPredicate: PREDICATE },
        },
      }),
      claim = await submit(
        urlA,
        a,
        {
          kind: "claim",
          subject,
          predicate: PREDICATE,
          value: true,
          domain: "rchain-casper",
          method: VERIFIER,
          assumptions: [
            "the CI checkout is the declared upstream revision",
            "the witness records the exact targeted cargo-test exit status and file digests",
          ],
          confidence: { ppm: null, basis: "bounded pinned-upstream execution evidence" },
          falsifier: "rerun the exact pinned cargo test or alter any bound witness field",
        },
        [task.id],
      ),
      evidence = await submit(urlA, a, {
        kind: "evidence",
        claimId: claim.id,
        relation: "supports",
        method: "pinned upstream cargo-test artifact",
        artifact: { digest: subject, mediaType: "application/json", content: witness },
      }),
      request = await submit(urlA, a, {
        kind: "verification_request",
        claimId: claim.id,
        evidenceIds: [evidence.id],
        verifier: VERIFIER,
      });

    await sync(urlB);
    await sync(urlC);
    await sync(urlB);
    let state = await view(urlA);
    assert.deepEqual(await view(urlB), state);
    assert.deepEqual(await view(urlC), state);
    const certificate = state.reproductionCertificates.find(
      (item) => item.claimId === claim.id && item.verdict === "SUPPORTED",
    );
    assert.ok(certificate?.valid);
    assert.ok(certificate.independentlyReproduced >= 2);
    assert.equal(certificate.taskId, task.id);
    assert.equal(state.claims.find((item) => item.id === claim.id)?.taskProvenanceValid, true);
    const beforeCrash = state.eventRoot;

    await stop(left.child, "SIGKILL");
    left = undefined;
    left = await launch(configA);
    assert.equal(left.url, urlA);
    assert.equal((await view(urlA)).eventRoot, beforeCrash);
    await sync(urlB);
    await sync(urlC);
    await sync(urlB);
    state = await view(urlA);
    assert.deepEqual(await view(urlB), state);
    assert.deepEqual(await view(urlC), state);

    const exported = await events(urlB);
    assert.deepEqual(replay([...exported].reverse().concat(exported.slice(0, 3)), policy), state);
    return {
      schema: "intelligence-lattice-experiment/v1",
      scope:
        "pinned unresolved RChain C192 upstream unit falsifier carried through a three-process evidence lifecycle; not a devnet rerun, repair, consensus proof or production-safety claim",
      runtime: {
        processes: 3,
        separateIdentities: true,
        independentWorkers: 2,
        separateDatabases: true,
        externalModelCalls: 0,
        verifier: VERIFIER,
        upstreamRepository: "rchain-community/rchain-rust",
        upstreamRevision: revision,
        upstreamIssue: 172,
        upstreamFinding: "C192",
      },
      checks: {
        upstreamWitnessBoundToTask: true,
        exactRevisionVerified: true,
        independentReproductionCertificate: true,
        coordinatorSigkillRecovery: true,
        threeProcessConvergence: true,
        deterministicReplay: true,
      },
      policy,
      witnessDigest: subject,
      requestId: request.id,
      events: exported,
      view: state,
    };
  } finally {
    if (left) await stop(left.child);
    if (right) await stop(right.child);
    if (third) await stop(third.child);
    await rm(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const witnessPath = process.argv[2],
    outputPath = process.argv[3];
  if (!witnessPath) throw new Error("witness JSON path required");
  const result = await runC192Lifecycle(witnessPath);
  if (outputPath) await writeFile(outputPath, JSON.stringify(result, null, 2) + "\n");
  process.stdout.write(
    JSON.stringify(
      {
        scope: result.scope,
        witnessDigest: result.witnessDigest,
        eventRoot: result.view.eventRoot,
        eventCount: result.view.eventCount,
        checks: result.checks,
      },
      null,
      2,
    ) + "\n",
  );
}
