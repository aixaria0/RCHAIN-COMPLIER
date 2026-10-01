import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { EventJournal } from "./journal.ts";
import { exchange, startNode } from "./node.ts";
import { canonical, MAX_EVENT_BYTES, MAX_BATCH_EVENTS, policyDigest } from "./protocol.ts";
import { fixture } from "./fixtures.ts";
async function fakePeer(reply: (r: ServerResponse) => void) {
  const server = createServer((_request, response) => reply(response));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const a = server.address();
  if (!a || typeof a === "string") throw new Error("listen failed");
  return {
    url: `http://127.0.0.1:${a.port}`,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
test("HTTP rejects malformed contributions and supplied peers; unsupported work stays blocked", async () => {
  const f = fixture(),
    dir = mkdtempSync(join(tmpdir(), "lattice-http-")),
    node = await startNode({ directory: dir, identity: f.a, policy: f.policy, worker: true });
  const post = (path: string, body: string) => fetch(node.url + path, { method: "POST", body });
  try {
    assert.equal(
      (await post("/events", canonical({ ...f.bad, signatureHex: "0".repeat(128) }))).status,
      400,
    );
    assert.equal((await post("/events", "\uFEFF" + canonical(f.bad))).status, 400);
    assert.equal((await post("/sync", canonical({ peer: "http://127.0.0.1:1" }))).status, 400);
    assert.equal((await fetch(node.url + "/events?after=-1")).status, 400);
    assert.equal((await post("/execute", "{}")).status, 404);
    assert.equal(node.journal.allEvents().length, 1);
    for (const e of [f.bad, f.badEvidence])
      assert.equal((await post("/events", canonical(e))).status, 200);
    const request = f.emit(f.b, {
      kind: "verification_request",
      claimId: f.bad.id,
      evidenceIds: [f.badEvidence.id],
      verifier: "unknown/v1",
    });
    assert.equal((await post("/events", canonical(request))).status, 200);
    assert.equal(node.journal.view().verifications.length, 0);
    assert.ok(
      node.journal
        .view()
        .blocked.some((b) => b.id === request.id && b.reason === "unregistered verifier"),
    );
  } finally {
    await node.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("omitted and duplicate page entries, foreign policy and oversized bodies cannot enter storage", async () => {
  const f = fixture(),
    dir = mkdtempSync(join(tmpdir(), "lattice-peer-")),
    j = new EventJournal(dir, f.policy);
  let wire = "";
  const peer = await fakePeer((r) => r.end(wire));
  const page = (n: number, digest = policyDigest(f.policy)) =>
    canonical({
      schema: "intelligence-lattice-page/v1",
      policyDigest: digest,
      ceiling: n,
      nextCursor: n,
      hasMore: false,
    }) + "\n";
  try {
    wire = page(1);
    await assert.rejects(exchange(j, peer.url), /page/);
    wire = page(2) + canonical(f.bad) + "\n" + canonical(f.bad) + "\n";
    await assert.rejects(exchange(j, peer.url), /duplicate/);
    wire = page(0, policyDigest({ ...f.policy, latticeId: "foreign" }));
    await assert.rejects(exchange(j, peer.url), /page/);
    wire = "x".repeat(MAX_EVENT_BYTES * (MAX_BATCH_EVENTS + 1) + 1);
    await assert.rejects(exchange(j, peer.url), /byte limit/);
    assert.equal(j.allEvents().length, 0);
  } finally {
    await peer.close();
    j.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("peer redirects are refused and the whole exchange has a deadline", async () => {
  const f = fixture(),
    dir = mkdtempSync(join(tmpdir(), "lattice-deadline-")),
    j = new EventJournal(dir, f.policy);
  let redirected = 0;
  const destination = await fakePeer((r) => {
      redirected++;
      r.end("unexpected");
    }),
    redirect = await fakePeer((r) => {
      r.writeHead(302, { location: destination.url });
      r.end();
    }),
    silent = await fakePeer(() => {});
  try {
    await assert.rejects(exchange(j, redirect.url));
    assert.equal(redirected, 0);
    const start = performance.now();
    await assert.rejects(exchange(j, silent.url, AbortSignal.timeout(50)));
    assert.ok(performance.now() - start < 1500);
    assert.equal(j.allEvents().length, 0);
  } finally {
    await redirect.close();
    await destination.close();
    await silent.close();
    j.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
