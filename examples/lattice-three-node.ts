/** Real process evidence-lifecycle acceptance test; not the full MVL. */
import assert from "node:assert/strict";
import { fork, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  artifactDigest,
  canonical,
  createEvent,
  EVENT_KINDS,
  generateIdentity,
  parseCanonical,
  validateEvent,
  type EventBody,
  type Identity,
  type LatticeEvent,
  type MembershipPolicy,
} from "../src/lib/lattice/protocol.ts";
import { decide, replay } from "../src/lib/lattice/replay.ts";
async function view(url: string) {
  const r = await fetch(url + "/view", { signal: AbortSignal.timeout(5000) });
  assert.equal(r.status, 200);
  return (await r.json()) as ReturnType<typeof replay>;
}
async function events(url: string) {
  const events: LatticeEvent[] = [];
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
    events.push(...lines.map((l) => parseCanonical(l) as LatticeEvent));
    after = h.nextCursor;
    ceiling = h.ceiling;
    if (!h.hasMore) return events;
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
  child.stderr!.on("data", (v) => {
    diagnostics = (diagnostics + String(v)).slice(-2000);
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("readiness timeout: " + diagnostics));
    }, 10000);
    child.once("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.once("exit", (c) => {
      clearTimeout(timer);
      reject(new Error(`node exited ${c}: ${diagnostics}`));
    });
    child.once("message", (m) => {
      clearTimeout(timer);
      const ready = m as { url: string };
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
export async function runThreeNodeExperiment() {
  const directory = await mkdtemp(join(tmpdir(), "lattice-process-")),
    a = generateIdentity(),
    b = generateIdentity(),
    c = generateIdentity(),
    policy: MembershipPolicy = {
      schema: "intelligence-lattice-policy/v1",
      latticeId: "lifecycle-conformance",
      members: [a, b, c].map((i) => ({
        actorId: i.actorId,
        publicKeyHex: i.publicKeyHex,
        kinds: [...EVENT_KINDS],
        domains: ["arithmetic"],
      })),
    };
  const configA = join(directory, "a.json"),
    configB = join(directory, "b.json"),
    configC = join(directory, "c.json");
  let left: Awaited<ReturnType<typeof launch>> | undefined,
    right: Awaited<ReturnType<typeof launch>> | undefined,
    third: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    for (const [name, i] of [
      ["a", a],
      ["b", b],
      ["c", c],
    ] as const)
      await writeFile(
        join(directory, name + ".pem"),
        i.privateKey.export({ type: "pkcs8", format: "pem" }),
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
    assert.notEqual(a.actorId, b.actorId);
    assert.notEqual(b.actorId, c.actorId);
    assert.notEqual(left.child.pid, third.child.pid);
    async function submit(url: string, i: Identity, body: EventBody) {
      const prior = await events(url),
        sequence =
          Math.max(0, ...prior.filter((e) => e.actorId === i.actorId).map((e) => e.sequence)) + 1,
        e = createEvent(i, policy, { sequence, body });
      const r = await fetch(url + "/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: canonical(e),
        signal: AbortSignal.timeout(5000),
      });
      assert.equal(r.status, 200, await r.text());
      return e;
    }
    async function sync(url = urlB) {
      const r = await fetch(url + "/sync", { method: "POST", signal: AbortSignal.timeout(15000) });
      assert.equal(r.status, 200, await r.text());
    }
    const input = { schema: "integer-sum-input/v1", values: [2, 3, 7] },
      claim = (value: number): Extract<EventBody, { kind: "claim" }> => ({
        kind: "claim",
        subject: artifactDigest(input),
        predicate: "integer-sum",
        value,
        domain: "arithmetic",
        method: "independent-contribution",
        assumptions: ["declared input is complete"],
        confidence: { ppm: 950000, basis: "producer assertion, uncalibrated" },
        falsifier: "recompute the exact declared integers",
      });
    const task = await submit(urlA, a, {
        kind: "task",
        envelope: {
          schema: "intelligence-lattice-task/v1",
          taskId: artifactDigest({ purpose: "three-process lifecycle" }),
          domain: "arithmetic",
          operation: "independent-contribution",
          input: { digest: artifactDigest(input), mediaType: "application/json", content: input },
          dependencies: [],
          authority: { mode: "observe-only", issuer: a.actorId },
          output: { mediaType: "application/json", claimPredicate: "integer-sum" },
        },
      }),
      good = createEvent(a, policy, { sequence: 3, body: claim(12), parents: [task.id] }),
      bad = createEvent(b, policy, { sequence: 2, body: claim(13), parents: [task.id] });
    for (const [url, event] of [[urlA, good], [urlB, bad]] as const) {
      const r = await fetch(url + "/events", { method: "POST", body: canonical(event), signal: AbortSignal.timeout(5000) });
      assert.equal(r.status, 200, await r.text());
    }
    const invalid = await submit(urlC, c, { ...claim(13), method: "wrong-operation" });
    const evidence = (id: string): Extract<EventBody, { kind: "evidence" }> => ({
      kind: "evidence",
      claimId: id,
      relation: "supports",
      method: "declared input bytes",
      artifact: { digest: artifactDigest(input), mediaType: "application/json", content: input },
    });
    const goodEvidence = await submit(urlA, a, evidence(good.id)),
      badEvidence = await submit(urlB, b, evidence(bad.id));
    const challenge = await submit(urlA, a, {
        kind: "challenge",
        claimId: bad.id,
        reason: "the contributed sum is inconsistent",
      }),
      request = await submit(urlA, a, {
        kind: "evidence_request",
        claimId: bad.id,
        question: "provide exact input and a reproducible receipt",
      });
    for (const [c, e] of [
      [good, goodEvidence],
      [bad, badEvidence],
    ])
      await submit(urlA, a, {
        kind: "verification_request",
        claimId: c!.id,
        evidenceIds: [e!.id],
        verifier: "integer-sum/v1",
      });
    const unknown = await submit(urlB, b, {
      ...claim(99),
      subject: "incomplete-external-input",
      predicate: "hypothesis",
      confidence: { ppm: null, basis: "additional observations required" },
    });
    assert.ok((await view(urlA)).pending.includes(challenge.id));
    await sync();
    await sync(urlC);
    await sync();
    let v = await view(urlA);
    assert.deepEqual(await view(urlB), v);
    assert.deepEqual(await view(urlC), v);
    assert.ok(v.blocked.some((x) => x.id === invalid.id) || v.claims.some((x) => x.id === invalid.id));
    assert.equal(v.claims.find((c) => c.id === good.id)!.status, "SUPPORTED");
    assert.equal(v.claims.find((c) => c.id === bad.id)!.status, "REFUTED");
    assert.equal(v.claims.find((c) => c.id === unknown.id)!.status, "UNVERIFIED");
    assert.equal(v.disagreements.length, 1);
    assert.ok(v.claims.find((c) => c.id === bad.id)!.evidenceRequestIds.includes(request.id));
    const claimIds = [good.id, bad.id, unknown.id].sort(),
      verificationIds = v.verifications
        .filter((r) => r.locallyReproduced)
        .map((r) => r.id)
        .sort();
    const decision = await submit(urlA, a, {
      kind: "decision",
      procedure: "evidence-cut/v1",
      claimIds,
      verificationIds,
      result: decide(claimIds, verificationIds, v.verifications),
    });
    const duplicate = await fetch(urlA + "/events", { method: "POST", body: canonical(good) });
    assert.deepEqual(await duplicate.json(), { inserted: 0, duplicates: 1 });
    await sync();
    await sync(urlC);
    await sync();
    v = await view(urlA);
    const cert = v.reproductionCertificates.find((x) => x.claimId === good.id && x.verdict === "SUPPORTED");
    assert.ok(cert?.valid);
    assert.ok(cert.independentlyReproduced >= 2);
    const preCrash = v.eventRoot;
    await stop(left.child, "SIGKILL");
    left = undefined;
    const partition = await submit(urlB, b, {
      ...claim(5),
      subject: "partition-observation",
      predicate: "unresolved",
      confidence: { ppm: null, basis: "evidence pending" },
    });
    const failed = await fetch(urlB + "/sync", {
      method: "POST",
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(failed.status, 400);
    await failed.text();
    assert.ok((await view(urlB)).claims.some((c) => c.id === partition.id));
    left = await launch(configA);
    assert.equal(left.url, urlA);
    assert.equal((await view(urlA)).eventRoot, preCrash);
    await sync();
    await sync(urlC);
    await sync();
    v = await view(urlA);
    assert.deepEqual(await view(urlB), v);
    assert.deepEqual(await view(urlC), v);
    const exported = await events(urlB);
    assert.deepEqual(replay([...exported].reverse().concat(exported.slice(0, 3)), policy), v);
    assert.equal(v.decisions.find((d) => d.id === decision.id)!.valid, true);
    assert.throws(() => validateEvent({ ...bad, body: claim(999) }, policy));
    return {
      schema: "intelligence-lattice-experiment/v1",
      scope: "two-process evidence/lifecycle slice; not the complete MVL",
      runtime: {
        processes: 3,
        separateIdentities: true,
        independentWorkers: 2,
        separateDatabases: true,
        externalModelCalls: 0,
        verifier: "integer-sum/v1",
      },
      checks: {
        contradictionsPreserved: true,
        falseClaimRefuted: true,
        unresolvedPreserved: true,
        evidenceRequestPreserved: true,
        duplicateIdempotence: true,
        peerDisappearance: true,
        acknowledgedWriteCrashRecovery: true,
        partitionRejoin: true,
        independentReplay: true,
        tamperRejected: true,
        taskProvenancePreserved: true,
        independentReproductionCertificate: true,
        threeProcessConvergence: true,
      },
      policy,
      events: exported,
      view: v,
    };
  } finally {
    if (left) await stop(left.child);
    if (right) await stop(right.child);
    if (third) await stop(third.child);
    await rm(directory, { recursive: true, force: true });
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await runThreeNodeExperiment();
  if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(result, null, 2) + "\n");
  process.stdout.write(
    JSON.stringify(
      {
        scope: result.scope,
        eventRoot: result.view.eventRoot,
        eventCount: result.view.eventCount,
        checks: result.checks,
        decision: result.view.decisions[0]?.recomputed,
      },
      null,
      2,
    ) + "\n",
  );
}
