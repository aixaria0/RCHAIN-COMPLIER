import assert from "node:assert/strict";
import { test } from "node:test";
import { isMigrationFile, migrationName, pendingMigrations } from "./migration-plan.mjs";

test("_migrations keys on basename, not path", () => {
  assert.equal(migrationName("/migrations/0002_todos.sql"), "0002_todos.sql");
  assert.equal(migrationName("migrations/subdir/0001_first.sql"), "0001_first.sql");
  assert.equal(migrationName("0001_first.sql"), "0001_first.sql");
});

test("a file already applied from another directory does not re-apply", () => {
  assert.deepEqual(
    pendingMigrations(["/migrations/0001_first.sql"], ["0001_first.sql"]),
    [],
  );
});

test("pending migrations are returned in name order", () => {
  assert.deepEqual(
    pendingMigrations(
      ["/migrations/0003_c.sql", "/migrations/0001_a.sql", "/migrations/0002_b.sql"],
      ["0001_a.sql"],
    ),
    [
      { name: "0002_b.sql", path: "/migrations/0002_b.sql" },
      { name: "0003_c.sql", path: "/migrations/0003_c.sql" },
    ],
  );
});

test("non-SQL entries are ignored", () => {
  assert.equal(isMigrationFile("notes.txt"), false);
  assert.deepEqual(pendingMigrations(["notes.txt", "assets", "README.md"], []), []);
});
