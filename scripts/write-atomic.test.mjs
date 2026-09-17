import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import {
  handOver,
  parseWriteAtomicArgs,
  stagingError,
  writeAtomic,
} from "./write-atomic.mjs";

const SCRIPT = join(process.cwd(), "scripts/write-atomic.mjs");

function makeWorkspace() {
  const root = mkdtempSync(join(tmpdir(), "write-atomic-"));
  mkdirSync(join(root, "public"), { recursive: true });
  return root;
}

test("parseWriteAtomicArgs needs exactly a staged file and a target", () => {
  assert.deepEqual(parseWriteAtomicArgs([]), { error: "usage" });
  assert.deepEqual(parseWriteAtomicArgs(["a"]), { error: "usage" });
  assert.equal(parseWriteAtomicArgs(["a", "b"]).error, undefined);
});

test("stagingError refuses a temp inside public/ and a no-op move", () => {
  assert.equal(
    stagingError({
      staged: "/workspace/public/og.jpg.tmp",
      target: "/workspace/public/og.jpg",
      publicDir: "/workspace/public",
    }),
    "stage outside public/",
  );
  assert.equal(
    stagingError({
      staged: "/workspace/public/og.jpg",
      target: "/workspace/public/og.jpg",
      publicDir: "/workspace/public",
    }),
    "stage outside public/",
  );
});

test("handOver replaces the target and clears the staged file", () => {
  const root = makeWorkspace();
  const staged = join(root, "og.tmp");
  const target = join(root, "og.jpg");
  writeFileSync(staged, "new");
  writeFileSync(target, "old");
  handOver(staged, target);
  assert.equal(readFileSync(target, "utf8"), "new");
  assert.equal(existsSync(staged), false);
});

test("handOver creates a missing target directory", () => {
  const root = makeWorkspace();
  const staged = join(root, "tmp", "artifact");
  const target = join(root, "nested", "artifact");
  mkdirSync(join(root, "tmp"), { recursive: true });
  writeFileSync(staged, "new");
  handOver(staged, target);
  assert.equal(readFileSync(target, "utf8"), "new");
  assert.equal(existsSync(staged), false);
});

test("an interrupted pass leaves the target on its old bytes, temp-free", () => {
  const root = makeWorkspace();
  const staged = join(root, "og.tmp");
  const target = join(root, "og.jpg");
  writeFileSync(staged, "new");
  writeFileSync(target, "old");
  assert.throws(() => writeAtomic(staged, target, { beforeRename: () => { throw new Error("interrupted"); } }));
  assert.equal(readFileSync(target, "utf8"), "old");
  assert.equal(existsSync(staged), true);
});

test("a failed hand-over creates no directory for the target it never wrote", () => {
  const root = makeWorkspace();
  const staged = join(root, "missing.tmp");
  const target = join(root, "absent", "og.jpg");
  assert.throws(() => handOver(staged, target));
  assert.equal(existsSync(join(root, "absent")), false);
});

test("a staged file on another filesystem is refused, not copied", () => {
  const root = makeWorkspace();
  const staged = join(root, "public/og.jpg.tmp");
  writeFileSync(staged, "half a JPEG");
  const refused = spawnSync(
    process.execPath,
    [SCRIPT, staged, join(root, "public/og.jpg")],
    { encoding: "utf8" },
  );
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /stage outside/);
  assert.equal(existsSync(staged), false);
});

test("cli: relative paths follow the script's root, not the caller's cwd", () => {
  const root = makeWorkspace();
  writeFileSync(join(root, "public/og.jpg.tmp"), "half a JPEG");
  const run = spawnSync(process.execPath, [SCRIPT, "public/og.jpg.tmp", "public/og.jpg"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.match(run.stderr, /stage outside/);
  assert.equal(readFileSync(join(root, "public/og.jpg.tmp"), "utf8"), "half a JPEG");
  assert.equal(existsSync(join(root, "public/og.jpg")), false);
});

test("cli: a missing staged file fails without touching the target", () => {
  const root = makeWorkspace();
  writeFileSync(join(root, "public/og.jpg"), "old card");
  const run = spawnSync(
    process.execPath,
    [SCRIPT, join(root, ".tmp/absent.tmp"), join(root, "public/og.jpg")],
    { encoding: "utf8" },
  );
  assert.equal(run.status, 1);
  assert.match(run.stderr, /\[write-atomic\]/);
  assert.equal(readFileSync(join(root, "public/og.jpg"), "utf8"), "old card");
});
