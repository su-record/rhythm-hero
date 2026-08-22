import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { openDatabase } from "../../server/db.mjs";

const sampleState = {
  profile: { name: "수", toy: "bouncer", toyName: "통통", createdAt: "2026-08-22T01:00:00.000Z" },
  companion: { voice: true, idleMinutes: 90 },
  categories: [
    { id: "read", name: "독서", color: "#20D68A", goal: 60, weeklyGoal: 300, status: "active" },
    { id: "move", name: "운동", color: "#FF5D52", goal: 30, weeklyGoal: 0, status: "archived" },
  ],
  assignments: ["read", "move"],
  sessions: [
    { id: "s1", categoryId: "read", startedAt: "2026-08-22T01:00:00.000Z", endedAt: "2026-08-22T01:30:00.000Z", source: "device", status: "completed", memo: "3장까지", memoCaptureState: "saved", memoUpdatedAt: "2026-08-22T01:31:00.000Z" },
    { id: "s2", categoryId: "move", startedAt: "2026-08-22T02:00:00.000Z", endedAt: "2026-08-22T02:20:00.000Z", source: "app", status: "deleted", deletedAt: "2026-08-22T03:00:00.000Z" },
  ],
  activeSession: { id: "live", categoryId: "read", startedAt: "2026-08-22T04:00:00.000Z", source: "device", status: "running" },
  historyRange: 30,
  reflectionRange: 7,
  aiReflection: null,
  updatedAt: "2026-08-22T04:05:00.000Z",
};

async function withDatabase(run) {
  const dir = await mkdtemp(join(tmpdir(), "rhythm-hero-db-"));
  const db = openDatabase(dir);
  try {
    await run(db, dir);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
}

test("a state round-trips through normalised tables without losing a field", () => withDatabase((db) => {
  db.saveState("client-a", sampleState);
  const loaded = db.loadState("client-a");
  const { weeklyGoal: _none, ...moveWithoutEmptyGoal } = sampleState.categories[1];
  assert.deepEqual(loaded, { ...sampleState, categories: [sampleState.categories[0], moveWithoutEmptyGoal] }, "a zero weekly goal means none and is not echoed back");
}));

test("a missing client is null, never an empty state that could wipe a device", () => withDatabase((db) => {
  assert.equal(db.loadState("nobody"), null);
}));

test("saving again replaces the rows instead of accumulating duplicates", () => withDatabase((db) => {
  db.saveState("client-a", sampleState);
  const shorter = { ...sampleState, sessions: [sampleState.sessions[0]], categories: [sampleState.categories[0]] };
  db.saveState("client-a", shorter);
  const loaded = db.loadState("client-a");
  assert.equal(loaded.sessions.length, 1);
  assert.equal(loaded.categories.length, 1);
}));

test("clients are isolated from each other", () => withDatabase((db) => {
  db.saveState("client-a", sampleState);
  db.saveState("client-b", { ...sampleState, profile: null, sessions: [] });
  assert.equal(db.loadState("client-a").sessions.length, 2);
  assert.equal(db.loadState("client-b").sessions.length, 0);
  assert.equal(db.loadState("client-b").profile, null);
  assert.equal(db.clientCount(), 2);
}));

test("legacy JSON files are imported once and then set aside", () => withDatabase(async (db, dir) => {
  await writeFile(join(dir, "legacyclient0001.json"), JSON.stringify({ ...sampleState, profile: null }));
  await writeFile(join(dir, "notes.json"), JSON.stringify({ hello: "world" }));

  assert.equal(db.importLegacyFiles(), 1);
  assert.equal(db.loadState("legacyclient0001").sessions.length, 2);
  assert.equal(db.importLegacyFiles(), 0, "a second run finds nothing left to import");
  const files = await readdir(dir);
  assert.ok(files.includes("legacyclient0001.json.imported"));
  assert.ok(!files.includes("legacyclient0001.json"));
}));
