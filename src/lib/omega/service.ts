import { createServer } from "node:http";
import type { OmegaNode } from "./node.ts";

function reply(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

export async function startOmegaService(node: OmegaNode, port = 0) {
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) throw new Error("invalid Omega service port");
  const server = createServer(async (request, response) => {
    try {
      const route = new URL(request.url ?? "/", "http://127.0.0.1");
      if (request.method !== "GET") return reply(response, 405, { error: "GET required" });
      if (route.pathname === "/health") {
        const status = await node.status();
        return reply(response, status.state === "ONLINE" ? 200 : 503, {
          schema: "omega-health/v1",
          state: status.state,
          nodeId: status.nodeId,
          bootId: status.bootId,
        });
      }
      if (route.pathname === "/omega/status") return reply(response, 200, await node.status());
      if (route.pathname === "/omega/proof") return reply(response, 200, await node.prove());
      if (route.pathname === "/omega/trust") return reply(response, 200, node.trust());
      return reply(response, 404, { error: "unknown route" });
    } catch (cause) {
      return reply(response, 500, {
        error: cause instanceof Error ? cause.message : "Omega service failure",
      });
    }
  });
  server.maxConnections = 16;
  server.maxRequestsPerSocket = 64;
  server.headersTimeout = 3000;
  server.requestTimeout = 5000;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing Omega listen address");
  let closed: Promise<void> | undefined;
  return {
    url: `http://127.0.0.1:${address.port}`,
    async close() {
      if (!closed)
        closed = new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        });
      return closed;
    },
  };
}
