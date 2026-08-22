import test from "node:test";
import assert from "node:assert/strict";

import {
  applyActiveAssignments,
  completeActiveSession,
  getPendingMemoSessionIds,
  normalizeState,
  placeCategoryInSlot,
  updateSessionMemo,
} from "../../src/domain/state.ts";
import type { AppState } from "../../src/domain/types.ts";

function baseState(): AppState {
  return {
    profile: null,
    companion: { voice: true, idleMinutes: 90 },
    categories: [{ id: "read", name: "독서", color: "#20D68A", goal: 60, status: "active" }],
    assignments: ["read"],
    sessions: [],
    activeSession: {
      id: "session-1",
      categoryId: "read",
      startedAt: "2026-08-21T01:00:00.000Z",
      source: "device",
      status: "running",
    },
    historyRange: 7,
    reflectionRange: 7,
    aiReflection: null,
    updatedAt: "2026-08-21T01:00:00.000Z",
  };
}

test("completing a session creates one pending memo target without mutating the input state", () => {
  const original = baseState();
  const endedAt = "2026-08-21T01:42:00.000Z";
  const result = completeActiveSession(original, endedAt);

  assert.equal(original.sessions.length, 0);
  assert.equal(original.activeSession?.status, "running");
  assert.equal(result.state.activeSession, null);
  assert.equal(result.state.sessions.length, 1);
  assert.deepEqual(result.completedSession, {
    id: "session-1",
    categoryId: "read",
    startedAt: "2026-08-21T01:00:00.000Z",
    source: "device",
    status: "completed",
    endedAt,
    memoCaptureState: "pending",
    memoCaptureCreatedAt: endedAt,
  });
  assert.deepEqual(getPendingMemoSessionIds(result.state), ["session-1"]);
});

test("completing with no active session is a no-op", () => {
  const state = { ...baseState(), activeSession: null };
  const result = completeActiveSession(state);
  assert.equal(result.completedSession, null);
  assert.equal(result.state, state);
});

test("saving a memo trims it, caps its length and clears the pending flag", () => {
  const completed = completeActiveSession(baseState(), "2026-08-21T01:42:00.000Z").state;
  const longMemo = `  ${"가".repeat(200)}  `;
  const result = updateSessionMemo(completed, "session-1", longMemo, "saved", "2026-08-21T01:45:00.000Z");

  assert.equal(result.updatedSession?.memo?.length, 160);
  assert.equal(result.updatedSession?.memoCaptureState, "saved");
  assert.equal(result.updatedSession?.memoUpdatedAt, "2026-08-21T01:45:00.000Z");
  assert.deepEqual(getPendingMemoSessionIds(result.state), []);
});

test("skipping a memo removes the session from pending without changing its duration", () => {
  const completed = completeActiveSession(baseState(), "2026-08-21T01:42:00.000Z").state;
  const result = updateSessionMemo(completed, "session-1", "", "skipped", "2026-08-21T01:46:00.000Z");

  assert.equal(result.updatedSession?.memoCaptureState, "skipped");
  assert.equal(result.updatedSession?.endedAt, "2026-08-21T01:42:00.000Z");
  assert.deepEqual(getPendingMemoSessionIds(result.state), []);
});

test("a saved memo must contain visible text", () => {
  const completed = completeActiveSession(baseState(), "2026-08-21T01:42:00.000Z").state;
  assert.throws(() => updateSessionMemo(completed, "session-1", "   ", "saved"), /A saved memo cannot be empty/);
});

test("pending memo targets are ordered by when they ended", () => {
  const state = baseState();
  state.activeSession = null;
  state.sessions = [
    { id: "late", categoryId: "read", startedAt: "2026-08-21T05:00:00.000Z", endedAt: "2026-08-21T06:00:00.000Z", source: "device", status: "completed", memoCaptureState: "pending" },
    { id: "early", categoryId: "read", startedAt: "2026-08-21T01:00:00.000Z", endedAt: "2026-08-21T02:00:00.000Z", source: "device", status: "completed", memoCaptureState: "pending" },
  ];
  assert.deepEqual(getPendingMemoSessionIds(state), ["early", "late"]);
});

test("Active 4 slots swap instead of duplicating a category", () => {
  assert.deepEqual(placeCategoryInSlot(["a", "b", "c", "d"], 0, "c"), ["c", "b", "a", "d"]);
  assert.deepEqual(placeCategoryInSlot(["a", "b", "c", "d"], 1, "x"), ["a", "x", "c", "d"]);
  assert.throws(() => placeCategoryInSlot(["a"], 4, "a"), /Invalid Active 4 slot/);
});

test("assigning an archived category to Active 4 reactivates it", () => {
  const state = baseState();
  state.categories = [
    { id: "read", name: "독서", color: "#20D68A", goal: 60, status: "active" },
    { id: "move", name: "운동", color: "#FF5D52", goal: 60, status: "archived" },
  ];
  const next = applyActiveAssignments(state, ["move"]);
  assert.equal(next.categories.find((category) => category.id === "move")?.status, "active");
  assert.equal(next.sessions, state.sessions);
});

test("Active 4 rejects duplicates and unknown categories", () => {
  const state = { ...baseState(), assignments: ["read", "read"] };
  assert.throws(() => applyActiveAssignments(state, ["read", "read"]), /must be unique/);
  assert.throws(() => applyActiveAssignments(baseState(), ["ghost"]), /Unknown Category assignment/);
});

test("normalizeState repairs states written by older builds", () => {
  const legacy = {
    profile: null,
    companion: { voice: true, idleMinutes: 90 },
    categories: [{ id: "read", name: "독서", color: "#8EB5E8", goal: 60 }],
    assignments: ["read"],
    historyRange: 99,
    reflectionRange: 30,
  } as unknown as AppState;
  const normalized = normalizeState(legacy);

  assert.equal(normalized.categories[0]?.status, "active");
  assert.equal(normalized.categories[0]?.color, "#20D68A", "the legacy pastel palette is migrated");
  assert.deepEqual(normalized.sessions, []);
  assert.equal(normalized.historyRange, 7, "an out-of-range value falls back instead of leaking into the UI");
  assert.equal(normalized.reflectionRange, 30);
  assert.equal(normalized.aiReflection, null);
  assert.ok(normalized.updatedAt);
});
