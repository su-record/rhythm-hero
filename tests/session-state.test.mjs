import test from "node:test";
import assert from "node:assert/strict";

import { completeActiveSession, getPendingMemoSessionIds, updateSessionMemo } from "../state-utils.mjs";

function baseState() {
  return {
    categories: [{ id: "read", name: "독서", status: "active" }],
    assignments: ["read"],
    sessions: [],
    activeSession: {
      id: "session-1",
      categoryId: "read",
      startedAt: "2026-08-21T01:00:00.000Z",
      source: "device",
      status: "running",
    },
  };
}

test("completing a session creates one pending memo target without mutating the input state", () => {
  const original = baseState();
  const endedAt = "2026-08-21T01:42:00.000Z";
  const result = completeActiveSession(original, endedAt);

  assert.equal(original.sessions.length, 0);
  assert.equal(original.activeSession.status, "running");
  assert.equal(result.state.activeSession, null);
  assert.equal(result.state.sessions.length, 1);
  assert.deepEqual(result.completedSession, {
    ...original.activeSession,
    endedAt,
    status: "completed",
    memoCaptureState: "pending",
    memoCaptureCreatedAt: endedAt,
  });
  assert.deepEqual(getPendingMemoSessionIds(result.state), ["session-1"]);
});

test("legacy, saved, skipped, and deleted sessions never become pending automatically", () => {
  const state = baseState();
  state.activeSession = null;
  state.sessions = [
    { id: "legacy", status: "completed", startedAt: "2026-08-21T01:00:00.000Z", endedAt: "2026-08-21T01:10:00.000Z" },
    { id: "saved", status: "completed", memoCaptureState: "saved", startedAt: "2026-08-21T01:10:00.000Z", endedAt: "2026-08-21T01:20:00.000Z" },
    { id: "skipped", status: "completed", memoCaptureState: "skipped", startedAt: "2026-08-21T01:20:00.000Z", endedAt: "2026-08-21T01:30:00.000Z" },
    { id: "deleted", status: "deleted", memoCaptureState: "pending", startedAt: "2026-08-21T01:30:00.000Z", endedAt: "2026-08-21T01:40:00.000Z" },
  ];
  assert.deepEqual(getPendingMemoSessionIds(state), []);
});

test("saving a memo changes only memo metadata and preserves the recorded time", () => {
  const completed = completeActiveSession(baseState(), "2026-08-21T01:42:00.000Z").state;
  const before = completed.sessions[0];
  const result = updateSessionMemo(completed, "session-1", "  3장까지 읽음  ", "saved", "2026-08-21T01:43:00.000Z");

  assert.equal(result.updatedSession.memo, "3장까지 읽음");
  assert.equal(result.updatedSession.memoCaptureState, "saved");
  assert.equal(result.updatedSession.startedAt, before.startedAt);
  assert.equal(result.updatedSession.endedAt, before.endedAt);
  assert.deepEqual(getPendingMemoSessionIds(result.state), []);
});

test("skipping a memo removes the session from pending without changing its duration", () => {
  const completed = completeActiveSession(baseState(), "2026-08-21T01:00:08.000Z").state;
  const result = updateSessionMemo(completed, "session-1", "", "skipped", "2026-08-21T01:01:00.000Z");

  assert.equal(result.updatedSession.memo, "");
  assert.equal(result.updatedSession.memoCaptureState, "skipped");
  assert.equal(result.updatedSession.startedAt, "2026-08-21T01:00:00.000Z");
  assert.equal(result.updatedSession.endedAt, "2026-08-21T01:00:08.000Z");
  assert.deepEqual(getPendingMemoSessionIds(result.state), []);
});

test("a saved memo must contain visible text", () => {
  const completed = completeActiveSession(baseState(), "2026-08-21T01:42:00.000Z").state;
  assert.throws(() => updateSessionMemo(completed, "session-1", "   ", "saved"), /cannot be empty/);
});
