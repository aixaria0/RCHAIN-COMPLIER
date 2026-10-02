import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { startNode } from "../lattice/node.ts";
import { loadState, loadEngineIdentity, loadRegistry } from "./runtime.ts";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2]!,
    index = Number(process.argv[3]);
  if (![0, 1, 2].includes(index) || !process.send)
    throw new Error("Managed worker invocation required");
  const state = loadState(directory),
    identity = loadEngineIdentity(directory, index);
  if (identity.actorId !== state.policy.members[index]!.actorId)
    throw new Error("Configured identity mismatch");
  const node = await startNode({
    directory: join(directory, `journal-${index}`),
    policy: state.policy,
    identity,
    worker: index !== 0,
    peers: index === 0 ? [] : [process.argv[4]!],
    registry: await loadRegistry(state),
    onDiagnostic: (diagnostic) => process.send?.({ diagnostic }),
  });
  const shutdown = () => {
    void node.close().then(() => process.exit(0));
  };
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, shutdown);
  process.once("disconnect", shutdown);
  if (!process.connected) shutdown();
  else process.send!({ ready: true, url: node.url, actorId: identity.actorId });
}
