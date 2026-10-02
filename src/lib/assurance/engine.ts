import { fork, type ChildProcess } from "node:child_process";
import { mkdirSync, lstatSync, existsSync, readdirSync, writeFileSync, chmodSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  canonical,
  generateIdentity,
  policyDigest,
  type LatticeEvent,
  type MembershipPolicy,
} from "../lattice/protocol.ts";
import { EventJournal } from "../lattice/journal.ts";
import { readPeerEvents } from "../lattice/node.ts";
import type { VerifierRegistry } from "../lattice/verification.ts";
import { AssuranceError, operationalError } from "./errors.ts";
import { createSubmission, validateWorkload, workloadId, type Workload } from "./submission.ts";
import {
  exportEvidence,
  packageDigest,
  verifyEvidence,
  type VerificationContext,
  type VerificationReport,
} from "./package.ts";
import {
  loadState,
  loadEngineIdentity,
  loadRegistry,
  moduleDigest,
  type EngineState,
} from "./runtime.ts";

export interface Diagnostic {
  code: string;
  message: string;
  actorId?: string;
  requestId?: string;
  taskId?: string;
  status?: VerificationReport["status"];
  eventCount?: number;
  verifierCount?: number;
  durationMs?: number;
}
export interface InitOptions {
  integration?: "core" | "rchain";
  verifierModule?: string;
}
export interface RunResult {
  evidence: Uint8Array;
  context: VerificationContext;
  report: VerificationReport;
}
interface ManagedProcess {
  child: ChildProcess;
  url: string;
}

function privateDirectory(directory: string) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.mode & 0o077)
    throw new AssuranceError("IO_ERROR", "Engine directory must be ordinary and mode 0700");
}
/** A separate SQLite exclusive transaction is an OS-released single-supervisor lock. */
function acquire(directory: string): DatabaseSync {
  privateDirectory(directory);
  const file = join(directory, "supervisor.sqlite");
  if (existsSync(file) && (!lstatSync(file).isFile() || lstatSync(file).isSymbolicLink()))
    throw new AssuranceError("IO_ERROR", "Ordinary supervisor lock required");
  const db = new DatabaseSync(file);
  try {
    chmodSync(file, 0o600);
    db.exec("PRAGMA busy_timeout=0; BEGIN EXCLUSIVE;");
    return db;
  } catch (cause) {
    db.close();
    throw new AssuranceError(
      cause instanceof Error && cause.message.includes("database is locked") ? "BUSY" : "IO_ERROR",
      "Cannot acquire the supervisor lock; another supervisor or an unavailable lock database prevents startup",
      { cause },
    );
  }
}

export function initializeEngine(directory: string, options: InitOptions = {}): EngineState {
  privateDirectory(directory);
  const lock = acquire(directory);
  try {
    if (
      readdirSync(directory).some(
        (name) => !["supervisor.sqlite", "supervisor.sqlite-journal"].includes(name),
      )
    )
      throw new AssuranceError("INVALID_INPUT", "Initialization requires an empty directory");
    if (options.integration && !["core", "rchain"].includes(options.integration))
      throw new AssuranceError("INVALID_INPUT", "Unknown integration");
    const identities = Array.from({ length: 3 }, () => generateIdentity());
    const policy: MembershipPolicy = {
      schema: "intelligence-lattice-policy/v1",
      latticeId: `assurance-${identities[0]!.publicKeyHex.slice(0, 24)}`,
      members: identities.map((identity, index) => ({
        actorId: identity.actorId,
        publicKeyHex: identity.publicKeyHex,
        domains: ["*"],
        kinds:
          index === 0
            ? ["capability", "task", "claim", "evidence", "verification_request", "decision"]
            : ["capability", "verification"],
      })),
    };
    const verifierModule = options.verifierModule ? resolve(options.verifierModule) : null;
    const state: EngineState = {
      schema: "assurance-engine-state/v1",
      policy,
      integration: options.integration ?? "core",
      verifierModule,
      verifierModuleDigest: verifierModule ? moduleDigest(verifierModule) : null,
    };
    // Exclusive writes keep a failed or concurrent initialization from replacing identities.
    for (const [index, identity] of identities.entries())
      writeFileSync(
        join(directory, `identity-${index}.pem`),
        identity.privateKey.export({ type: "pkcs8", format: "pem" }),
        { mode: 0o600, flag: "wx" },
      );
    writeFileSync(join(directory, "engine.json"), canonical(state), { mode: 0o600, flag: "wx" });
    return state;
  } finally {
    lock.close();
  }
}

async function launch(
  directory: string,
  index: number,
  diagnostic: (d: Diagnostic) => void,
  peer?: string,
): Promise<ManagedProcess> {
  const source = fileURLToPath(new URL("./worker.ts", import.meta.url));
  // rewriteRelativeImportExtensions rewrites imports, not strings inside new URL.
  const entry = import.meta.url.endsWith(".ts") ? source : source.replace(/\.ts$/, ".js");
  const child = fork(entry, [directory, String(index), ...(peer ? [peer] : [])], {
    execArgv: entry.endsWith(".ts") ? ["--experimental-strip-types"] : [],
    stdio: ["ignore", "ignore", "pipe", "ipc"],
  });
  let stderr = "";
  child.stderr!.on("data", (chunk) => {
    stderr = (stderr + String(chunk)).slice(-2048);
  });
  return new Promise((res, rej) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      rej(new AssuranceError("TIMEOUT", "Worker readiness timeout"));
    }, 10000);
    child.once("error", (cause) => {
      clearTimeout(timer);
      rej(new AssuranceError("IO_ERROR", "Worker failed to launch", { cause }));
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (code !== 0 || signal)
        diagnostic({
          code: "PROCESS_EXIT",
          message: `worker ${index}: code=${code} signal=${signal}; ${stderr}`,
        });
      rej(new AssuranceError("IO_ERROR", "Worker exited before readiness"));
    });
    child.on("message", (message) => {
      const m = message as { ready?: boolean; url?: string; diagnostic?: Diagnostic };
      if (m.diagnostic) diagnostic(m.diagnostic);
      if (m.ready && typeof m.url === "string" && /^http:\/\/127\.0\.0\.1:\d+$/.test(m.url)) {
        clearTimeout(timer);
        res({ child, url: m.url });
      }
    });
  });
}

async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((res) => {
    const timer = setTimeout(() => child.kill("SIGKILL"), 2000);
    child.once("exit", () => {
      clearTimeout(timer);
      res();
    });
    child.kill("SIGTERM");
  });
}

export class AssuranceEngine {
  readonly directory: string;
  readonly state: EngineState;
  readonly registry: VerifierRegistry;
  private readonly lock: DatabaseSync;
  private readonly processes: ManagedProcess[];
  private busy = false;
  private closing: Promise<void> | undefined;
  private readonly diagnostic: (d: Diagnostic) => void;

  private constructor(
    directory: string,
    state: EngineState,
    registry: VerifierRegistry,
    lock: DatabaseSync,
    processes: ManagedProcess[],
    diagnostic: (d: Diagnostic) => void,
  ) {
    this.directory = directory;
    this.state = state;
    this.registry = registry;
    this.lock = lock;
    this.processes = processes;
    this.diagnostic = diagnostic;
  }

  static async open(
    directory: string,
    options: { onDiagnostic?: (d: Diagnostic) => void } = {},
  ): Promise<AssuranceEngine> {
    const root = resolve(directory),
      lock = acquire(root),
      processes: ManagedProcess[] = [];
    const diagnostic = options.onDiagnostic ?? (() => {});
    try {
      const state = loadState(root),
        registry = await loadRegistry(state);
      for (let index = 0; index < 3; index++)
        processes.push(await launch(root, index, diagnostic, processes[0]?.url));
      return new AssuranceEngine(root, state, registry, lock, processes, diagnostic);
    } catch (cause) {
      await Promise.all(processes.map((p) => stop(p.child)));
      lock.close();
      throw operationalError(cause, "Engine startup failed");
    }
  }

  /** One bounded task at a time: concurrent submissions fail with BUSY instead of queueing without limit. */
  async run(input: Workload, timeoutMs = 15000): Promise<RunResult> {
    if (this.busy || this.closing)
      throw new AssuranceError("BUSY", "Engine is running a task or closing");
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60000)
      throw new AssuranceError(
        "INVALID_INPUT",
        "Timeout must be an integer between 100 and 60000 ms",
      );
    const workload = validateWorkload(input),
      signal = AbortSignal.timeout(timeoutMs),
      started = performance.now();
    this.busy = true;
    try {
      const identity = loadEngineIdentity(this.directory, 0),
        policy = this.state.policy;
      // Owner exposes no signing endpoint. Its child only replicates; this supervisor is the only owner signer.
      const journal = new EventJournal(
        join(this.directory, "journal-0"),
        policy,
        4096,
        this.registry,
      );
      let target: { taskEventId: string; claimId: string };
      try {
        const events = journal.allEvents(),
          taskId = workloadId(workload);
        const tasks = events.filter(
          (e) =>
            e.body.kind === "task" &&
            e.body.envelope.taskId === taskId &&
            e.actorId === identity.actorId,
        );
        if (tasks.length > 1)
          throw new AssuranceError("BINDING_MISMATCH", "Ambiguous persisted task identity");
        const task = tasks[0],
          claims = task
            ? events.filter((e) => e.body.kind === "claim" && e.parents.includes(task.id))
            : [];
        if (task && claims.length !== 1)
          throw new AssuranceError(
            "BINDING_MISMATCH",
            "Persisted task lacks a unique submitted claim",
          );
        if (task) {
          const c = claims[0]!;
          if (
            task.body.kind !== "task" ||
            c.body.kind !== "claim" ||
            c.actorId !== identity.actorId ||
            canonical(task.body.envelope.input.content) !== canonical(workload.input) ||
            task.body.envelope.domain !== workload.domain ||
            task.body.envelope.operation !== workload.operation ||
            task.body.envelope.output.claimPredicate !== workload.predicate ||
            canonical(c.body.value) !== canonical(workload.value)
          )
            throw new AssuranceError(
              "BINDING_MISMATCH",
              "Persisted submission differs from workload",
            );
          target = { taskEventId: task.id, claimId: c.id };
        } else {
          const submission = createSubmission(
            workload,
            identity,
            policy,
            journal.nextSequence(identity.actorId),
          );
          journal.append(submission.events);
          target = submission;
        }
      } finally {
        journal.close();
      }
      // Workers pull the durable batch, independently reproduce, then push receipts back to the owner.
      for (const worker of this.processes.slice(1)) {
        const response = await fetch(worker.url + "/sync", {
          method: "POST",
          redirect: "error",
          signal,
        });
        await response.body?.cancel();
        if (!response.ok)
          throw new AssuranceError("IO_ERROR", `Worker sync HTTP ${response.status}`);
      }
      const events = await readPeerEvents(this.processes[0]!.url, policy, signal);
      const evidence = exportEvidence(events, policy, target, this.registry);
      const task = events.find((e) => e.id === target.taskEventId)!;
      if (task.body.kind !== "task")
        throw new AssuranceError("INTEGRITY_MISMATCH", "Task disappeared");
      const context: VerificationContext = {
        expectedPolicyDigest: policyDigest(policy),
        expectedTaskId: task.body.envelope.taskId,
        expectedClaimId: target.claimId,
        expectedPackageDigest: packageDigest(evidence),
      };
      const report = verifyEvidence(evidence, { ...context, registry: this.registry });
      this.diagnostic({
        code: report.code,
        message: "Task verification complete",
        taskId: report.taskId!,
        status: report.status,
        eventCount: report.eventCount,
        verifierCount: report.verifierActorIds.length,
        durationMs: Math.round(performance.now() - started),
      });
      return { evidence, context, report };
    } catch (cause) {
      if (signal.aborted)
        throw new AssuranceError(
          "TIMEOUT",
          "Task deadline expired; acknowledged events remain recoverable",
          { cause },
        );
      throw operationalError(
        cause,
        "Task execution or replication failed; retained events remain recoverable",
      );
    } finally {
      this.busy = false;
    }
  }

  get endpoints(): readonly string[] {
    return this.processes.map((p) => p.url);
  }
  get processIds(): readonly number[] {
    return this.processes.map((p) => p.child.pid!);
  }
  async events(): Promise<LatticeEvent[]> {
    return readPeerEvents(this.processes[0]!.url, this.state.policy);
  }

  /** Restart/rejoin the three identities from durable journals, without replacing keys or history. */
  async recover(): Promise<void> {
    if (this.busy || this.closing)
      throw new AssuranceError("BUSY", "Engine is running a task or closing");
    this.busy = true;
    try {
      await Promise.all(this.processes.map((p) => stop(p.child)));
      this.processes.splice(0);
      for (let index = 0; index < 3; index++)
        this.processes.push(
          await launch(this.directory, index, this.diagnostic, this.processes[0]?.url),
        );
    } catch (cause) {
      throw operationalError(cause, "Recovery failed; retained journals were not replaced");
    } finally {
      this.busy = false;
    }
  }

  close(): Promise<void> {
    if (!this.closing)
      this.closing = (async () => {
        await Promise.all(this.processes.map((p) => stop(p.child)));
        this.lock.close();
      })();
    return this.closing;
  }
}
