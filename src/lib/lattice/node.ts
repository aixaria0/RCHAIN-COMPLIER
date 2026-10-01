import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { lstatSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sha256Artifact } from "../compiler/ecosystem-chain.ts";
import { EventJournal, MAX_STORED_EVENTS } from "./journal.ts";
import {
  canonical,
  createEvent,
  exact,
  loadIdentity,
  MAX_BATCH_EVENTS,
  MAX_EVENT_BYTES,
  parseCanonical,
  policyDigest,
  validateEvent,
  type Identity,
  type MembershipPolicy,
} from "./protocol.ts";
import { verificationBody } from "./verification.ts";
const PAGE_BYTES = MAX_EVENT_BYTES * (MAX_BATCH_EVENTS + 1);
function loopback(raw: string) {
  const u = new URL(raw);
  if (
    u.protocol !== "http:" ||
    u.hostname !== "127.0.0.1" ||
    !u.port ||
    u.pathname !== "/" ||
    u.username ||
    u.password ||
    u.search ||
    u.hash
  )
    throw new Error("configured loopback peer required");
  return u;
}
async function responseBytes(response: Response, max: number) {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`peer HTTP ${response.status}`);
  }
  if (!response.body) throw new Error("missing body");
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let count = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      count += value.length;
      if (count > max) throw new Error("peer byte limit");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  }
  return Buffer.concat(chunks);
}
export async function exchange(
  journal: EventJournal,
  peer: string,
  signal = AbortSignal.timeout(10000),
) {
  const base = loopback(peer),
    seen = new Set<string>();
  let after = 0,
    ceiling: number | undefined;
  for (let round = 0; round <= MAX_STORED_EVENTS / MAX_BATCH_EVENTS; round++) {
    const route = new URL("events", base);
    route.searchParams.set("after", String(after));
    if (ceiling !== undefined) route.searchParams.set("ceiling", String(ceiling));
    const response = await fetch(route, {
      redirect: "error",
      credentials: "omit",
      signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]),
    });
    const bytes = await responseBytes(response, PAGE_BYTES),
      lines = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes).split("\n");
    if (lines.at(-1) !== "") throw new Error("unterminated page");
    lines.pop();
    const h = exact(parseCanonical(lines.shift() ?? ""), [
      "schema",
      "policyDigest",
      "ceiling",
      "nextCursor",
      "hasMore",
    ]) as {
      schema: string;
      policyDigest: string;
      ceiling: number;
      nextCursor: number;
      hasMore: boolean;
    };
    if (
      h.schema !== "intelligence-lattice-page/v1" ||
      h.policyDigest !== policyDigest(journal.policy) ||
      !Number.isSafeInteger(h.ceiling) ||
      h.ceiling < 0 ||
      h.ceiling > MAX_STORED_EVENTS ||
      (ceiling !== undefined && ceiling !== h.ceiling) ||
      !Number.isSafeInteger(h.nextCursor) ||
      h.nextCursor !== Math.min(after + MAX_BATCH_EVENTS, h.ceiling) ||
      h.nextCursor < after ||
      lines.length !== h.nextCursor - after ||
      typeof h.hasMore !== "boolean" ||
      h.hasMore !== h.nextCursor < h.ceiling
    )
      throw new Error("invalid peer page/cursor");
    const events = lines.map((line) => validateEvent(parseCanonical(line), journal.policy));
    for (const e of events) {
      if (seen.has(e.id)) throw new Error("duplicate cursor entry");
      seen.add(e.id);
    }
    journal.append(events);
    after = h.nextCursor;
    ceiling = h.ceiling;
    if (!h.hasMore) break;
    if (round === MAX_STORED_EVENTS / MAX_BATCH_EVENTS) throw new Error("exchange round limit");
  }
  for (const e of journal.allEvents()) {
    const r = await fetch(new URL("events", base), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: canonical(e),
      redirect: "error",
      credentials: "omit",
      signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]),
    });
    await responseBytes(r, MAX_EVENT_BYTES);
  }
}
async function requestBytes(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let count = 0;
  for await (const chunk of request) {
    const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    count += b.length;
    if (count > MAX_EVENT_BYTES) throw new Error("request byte limit");
    chunks.push(b);
  }
  return Buffer.concat(chunks);
}
function reply(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}
export interface NodeConfig {
  directory: string;
  policy: MembershipPolicy;
  identity: Identity;
  port?: number;
  peers?: string[];
  worker?: boolean;
}
export async function startNode(config: NodeConfig) {
  const peers = (config.peers ?? []).slice();
  if (peers.length > 8) throw new Error("peer limit");
  peers.forEach(loopback);
  const journal = new EventJournal(config.directory, config.policy),
    member = journal.policy.members.find((m) => m.actorId === config.identity.actorId);
  if (!member) {
    journal.close();
    throw new Error("node not admitted");
  }
  let syncing = false;
  function work() {
    if (!config.worker) return;
    const events = journal.allEvents(),
      map = new Map(events.map((e) => [e.id, e])),
      view = journal.view();
    for (const request of events)
      if (
        request.body.kind === "verification_request" &&
        view.ready.includes(request.id) &&
        !view.blocked.some((b) => b.id === request.id) &&
        !events.some(
          (e) =>
            e.actorId === config.identity.actorId &&
            e.body.kind === "verification" &&
            e.body.requestId === request.id,
        )
      ) {
        try {
          const claim = map.get(request.body.claimId);
          if (
            claim?.body.kind !== "claim" ||
            (!member!.domains.includes("*") && !member!.domains.includes(claim.body.domain))
          )
            continue;
          journal.append([
            createEvent(config.identity, journal.policy, {
              sequence: journal.nextSequence(config.identity.actorId),
              body: verificationBody(request, map),
            }),
          ]);
        } catch {
          /* Unsupported or incomplete requests remain visible; no fabricated result. */
        }
      }
  }
  try {
    if (
      !journal
        .allEvents()
        .some((e) => e.actorId === config.identity.actorId && e.body.kind === "capability")
    )
      journal.append([
        createEvent(config.identity, journal.policy, {
          sequence: journal.nextSequence(config.identity.actorId),
          body: {
            kind: "capability",
            operations: config.worker
              ? ["replicate-events/v1", "integer-sum/v1", "rchain-c192-upstream/v1"]
              : ["replicate-events/v1"],
            implementation: sha256Artifact(readFileSync(fileURLToPath(import.meta.url))),
          },
        }),
      ]);
    work();
  } catch (error) {
    journal.close();
    throw error;
  }
  const server = createServer(async (request, response) => {
    try {
      const route = new URL(request.url ?? "/", "http://127.0.0.1");
      if (request.method === "GET" && route.pathname === "/health")
        return reply(response, 200, {
          ready: true,
          actorId: config.identity.actorId,
          eventCount: journal.allEvents().length,
        });
      if (request.method === "GET" && route.pathname === "/identity")
        return reply(
          response,
          200,
          journal
            .allEvents()
            .find((e) => e.actorId === config.identity.actorId && e.body.kind === "capability"),
        );
      if (request.method === "GET" && route.pathname === "/view")
        return reply(response, 200, journal.view());
      if (request.method === "GET" && route.pathname === "/events") {
        const { events, ...header } = journal.page(
          Number(route.searchParams.get("after") ?? 0),
          route.searchParams.has("ceiling") ? Number(route.searchParams.get("ceiling")) : undefined,
        );
        response.writeHead(200, {
          "content-type": "application/x-ndjson",
          "cache-control": "no-store",
        });
        return response.end(
          [canonical(header), ...events.map((e) => canonical(e))].join("\n") + "\n",
        );
      }
      if (request.method === "POST" && route.pathname === "/events") {
        const e = validateEvent(parseCanonical(await requestBytes(request)), journal.policy),
          result = journal.append([e]);
        work();
        return reply(response, 200, result);
      }
      if (request.method === "POST" && route.pathname === "/sync") {
        if ((await requestBytes(request)).length)
          throw new Error("sync accepts no request-supplied peer");
        if (syncing) return reply(response, 409, { error: "sync already running" });
        syncing = true;
        try {
          const signal = AbortSignal.timeout(10000);
          for (const peer of peers) {
            await exchange(journal, peer, signal);
            work();
            await exchange(journal, peer, signal);
          }
        } finally {
          syncing = false;
        }
        return reply(response, 200, { eventRoot: journal.view().eventRoot });
      }
      reply(response, 404, { error: "unknown route" });
    } catch (error) {
      reply(response, 400, { error: error instanceof Error ? error.message : "request failed" });
    }
  });
  server.maxConnections = 32;
  server.headersTimeout = 3000;
  server.requestTimeout = 4000;
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(config.port ?? 0, "127.0.0.1", resolve);
    });
  } catch (error) {
    journal.close();
    throw error;
  }
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing listen address");
  return {
    url: `http://127.0.0.1:${address.port}`,
    journal,
    server,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      journal.close();
    },
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = JSON.parse(readFileSync(process.argv[2]!, "utf8")) as {
    directory: string;
    policy: MembershipPolicy;
    keyFile: string;
    port?: number;
    peers?: string[];
    worker?: boolean;
  };
  const key = lstatSync(config.keyFile);
  if (!key.isFile() || key.isSymbolicLink() || key.mode & 0o077)
    throw new Error("ordinary mode-0600 key file required");
  const identity = loadIdentity(readFileSync(config.keyFile, "utf8"));
  const node = await startNode({ ...config, identity });
  process.send?.({ url: node.url, actorId: identity.actorId });
  process.stdout.write(JSON.stringify({ ready: true, url: node.url }) + "\n");
  for (const signal of ["SIGTERM", "SIGINT"] as const)
    process.once(signal, () => {
      void node.close().then(() => process.exit(0));
    });
}
