/** SQLite owns durable transactions and WAL recovery; event order is not causal order. */
import { DatabaseSync } from "node:sqlite";
import { chmodSync, existsSync, lstatSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  canonical,
  MAX_BATCH_EVENTS,
  parseCanonical,
  policyDigest,
  validateEvent,
  type LatticeEvent,
  type MembershipPolicy,
} from "./protocol.ts";
import { replay } from "./replay.ts";
export const MAX_STORED_EVENTS = 4096;
interface Row {
  position: number;
  id: string;
  payload: string;
  actor_id: string;
  sequence: number;
}
export class EventJournal {
  readonly policy: MembershipPolicy;
  private readonly db: DatabaseSync;
  private readonly capacity: number;
  constructor(directory: string, policy: MembershipPolicy, capacity = MAX_STORED_EVENTS) {
    this.capacity = capacity;
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > MAX_STORED_EVENTS)
      throw new Error("invalid capacity");
    this.policy = JSON.parse(canonical(policy)) as MembershipPolicy;
    const digest = policyDigest(this.policy);
    for (const m of this.policy.members) {
      Object.freeze(m.kinds);
      Object.freeze(m.domains);
      Object.freeze(m);
    }
    Object.freeze(this.policy.members);
    Object.freeze(this.policy);
    if (
      existsSync(directory) &&
      (lstatSync(directory).isSymbolicLink() || !lstatSync(directory).isDirectory())
    )
      throw new Error("ordinary directory required");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (lstatSync(directory).mode & 0o077) throw new Error("directory mode 0700 required");
    const file = join(directory, "events.sqlite");
    if (existsSync(file) && (lstatSync(file).isSymbolicLink() || !lstatSync(file).isFile()))
      throw new Error("ordinary journal required");
    this.db = new DatabaseSync(file);
    try {
      chmodSync(file, 0o600);
      this.db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=250;");
      this.db.exec(
        "CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY,value TEXT NOT NULL);CREATE TABLE IF NOT EXISTS events (position INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,payload TEXT NOT NULL,actor_id TEXT NOT NULL,sequence INTEGER NOT NULL);",
      );
      this.db.exec("BEGIN IMMEDIATE");
      const old = this.db.prepare("SELECT value FROM metadata WHERE key='policy'").get() as
        { value: string } | undefined;
      if (old && old.value !== digest)
        throw new Error("journal policy mismatch; explicit migration required");
      this.db.prepare("INSERT OR IGNORE INTO metadata(key,value) VALUES ('policy',?)").run(digest);
      this.db.exec("COMMIT");
      const checks = this.db.prepare("PRAGMA quick_check").all();
      if (checks.length !== 1 || Object.values(checks[0]!)[0] !== "ok")
        throw new Error("SQLite corruption");
      this.allEvents();
    } catch (error) {
      if (this.db.isTransaction) this.db.exec("ROLLBACK");
      this.db.close();
      throw error;
    }
  }
  private decode(row: Row) {
    const e = validateEvent(parseCanonical(row.payload), this.policy);
    if (e.id !== row.id || e.actorId !== row.actor_id || e.sequence !== row.sequence)
      throw new Error("journal index/content corruption");
    return e;
  }
  allEvents(): LatticeEvent[] {
    const rows = this.db
      .prepare("SELECT position,id,payload,actor_id,sequence FROM events ORDER BY position")
      .all() as unknown as Row[];
    if (rows.length > this.capacity) throw new Error("capacity exceeded");
    if (rows.some((r, i) => r.position !== i + 1)) throw new Error("journal cursor corruption");
    return rows.map((r) => this.decode(r));
  }
  append(input: readonly unknown[]) {
    if (input.length > MAX_BATCH_EVENTS) throw new Error("batch limit");
    const events = input.map((e) => validateEvent(e, this.policy));
    let inserted = 0,
      duplicates = 0;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      let count = Number(
        (this.db.prepare("SELECT count(*) AS count FROM events").get() as { count: number }).count,
      );
      for (const e of events) {
        const payload = canonical(e),
          old = this.db.prepare("SELECT payload FROM events WHERE id=?").get(e.id) as
            { payload: string } | undefined;
        if (old) {
          if (old.payload !== payload) throw new Error("event ID collision");
          duplicates++;
          continue;
        }
        if (count >= this.capacity) throw new Error("capacity exhausted");
        this.db
          .prepare("INSERT INTO events(id,payload,actor_id,sequence) VALUES (?,?,?,?)")
          .run(e.id, payload, e.actorId, e.sequence);
        count++;
        inserted++;
      }
      this.db.exec("COMMIT");
      return { inserted, duplicates };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  nextSequence(actor: string) {
    const next =
      Number(
        (
          this.db
            .prepare("SELECT coalesce(max(sequence),0) AS sequence FROM events WHERE actor_id=?")
            .get(actor) as { sequence: number }
        ).sequence,
      ) + 1;
    if (!Number.isSafeInteger(next)) throw new Error("sequence exhausted");
    return next;
  }
  page(after = 0, ceiling?: number) {
    const high = Number(
        (
          this.db.prepare("SELECT coalesce(max(position),0) AS position FROM events").get() as {
            position: number;
          }
        ).position,
      ),
      end = ceiling ?? high;
    if (
      !Number.isSafeInteger(after) ||
      !Number.isSafeInteger(end) ||
      after < 0 ||
      end < after ||
      end > high
    )
      throw new Error("invalid cursor");
    const rows = this.db
      .prepare(
        "SELECT position,id,payload,actor_id,sequence FROM events WHERE position>? AND position<=? ORDER BY position LIMIT ?",
      )
      .all(after, end, MAX_BATCH_EVENTS) as unknown as Row[];
    const nextCursor = rows.at(-1)?.position ?? after;
    return {
      schema: "intelligence-lattice-page/v1",
      policyDigest: policyDigest(this.policy),
      ceiling: end,
      nextCursor,
      hasMore: nextCursor < end,
      events: rows.map((r) => this.decode(r)),
    };
  }
  view() {
    return replay(this.allEvents(), this.policy);
  }
  close() {
    this.db.close();
  }
}
