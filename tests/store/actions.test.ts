import test from "node:test";
import assert from "node:assert/strict";

import { createStore } from "../../src/store/store.ts";
import {
  deleteSession,
  editSession,
  isDuplicateCategoryName,
  pressButton,
  restoreSession,
  setCategoryGoalType,
  setHistoryRange,
  startSession,
  toggleArchiveCategory,
  upsertCategory,
} from "../../src/store/actions.ts";
import type { AppState, Session } from "../../src/domain/types.ts";

function baseState(overrides: Partial<AppState> = {}): AppState {
  return {
    profile: null,
    companion: { voice: true, idleMinutes: 90 },
    categories: [
      { id: "read", name: "독서", color: "#20D68A", goal: 60, status: "active" },
      { id: "move", name: "운동", color: "#FF5D52", goal: 60, status: "active" },
    ],
    assignments: ["read", "move"],
    sessions: [],
    activeSession: null,
    historyRange: 7,
    reflectionRange: 7,
    aiReflection: null,
    updatedAt: "2026-08-21T00:00:00.000Z",
    ...overrides,
  };
}

test("the store notifies subscribers once per real change and never for a no-op", () => {
  const store = createStore(baseState());
  let notifications = 0;
  store.subscribe(() => {
    notifications += 1;
  });

  store.update((state) => setHistoryRange(state, 30));
  assert.equal(notifications, 1);

  store.update((state) => setHistoryRange(state, 30));
  assert.equal(notifications, 1, "an identical result must not wake the UI");
  assert.equal(store.getState().historyRange, 30);
});

test("unsubscribing stops delivery", () => {
  const store = createStore(baseState());
  let notifications = 0;
  const unsubscribe = store.subscribe(() => {
    notifications += 1;
  });
  unsubscribe();
  store.update((state) => setHistoryRange(state, 30));
  assert.equal(notifications, 0);
});

test("starting a session leaves the previous state untouched", () => {
  const original = baseState();
  const result = startSession(original, "read", "device");

  assert.equal(original.activeSession, null);
  assert.equal(result.started?.id, "read");
  assert.equal(result.state.activeSession?.categoryId, "read");
  assert.equal(result.state.activeSession?.source, "device");
});

test("starting while another session runs reports the running one instead of switching", () => {
  const running = startSession(baseState(), "read", "device").state;
  const second = startSession(running, "move", "app");

  assert.equal(second.started, null);
  assert.equal(second.alreadyRunning?.id, "read");
  assert.equal(second.state, running, "no state change means no persist and no sync");
});

test("a button press starts, stops, and switches the way the hardware expects", () => {
  const idle = baseState();
  const started = pressButton(idle, 1);
  assert.equal(started.outcome.kind, "started");

  const stopped = pressButton(started.state, 1);
  assert.equal(stopped.outcome.kind, "stopped");
  assert.equal(stopped.state.activeSession, null);
  assert.equal(stopped.state.sessions.length, 1);

  const switched = pressButton(started.state, 2);
  assert.equal(switched.outcome.kind, "switched");
  assert.equal(switched.state.activeSession?.categoryId, "move");
  assert.equal(switched.state.sessions.length, 1, "the interrupted session is completed, not dropped");
});

test("an unassigned button changes nothing", () => {
  const state = baseState();
  const result = pressButton(state, 4);
  assert.deepEqual(result.outcome, { kind: "unassigned" });
  assert.equal(result.state, state);
});

function completedSession(): Session {
  return {
    id: "s1",
    categoryId: "read",
    startedAt: "2026-08-21T01:00:00.000Z",
    endedAt: "2026-08-21T01:30:00.000Z",
    source: "app",
    status: "completed",
    memoCaptureState: "pending",
  };
}

test("editing a session caps its length and settles the pending memo", () => {
  const state = baseState({ sessions: [completedSession()] });
  const edited = editSession(state, "s1", {
    categoryId: "move",
    startedAt: "2026-08-21T02:00:00.000Z",
    minutes: 5000,
    memo: "  ",
  });
  const session = edited.sessions[0];

  assert.equal(session?.categoryId, "move");
  assert.equal(new Date(session?.endedAt ?? 0).getTime() - new Date(session?.startedAt ?? 0).getTime(), 720 * 60_000);
  assert.equal(session?.memoCaptureState, "skipped", "an emptied memo stops asking");
});

test("a written memo is marked saved and timestamped", () => {
  const state = baseState({ sessions: [completedSession()] });
  const edited = editSession(state, "s1", {
    categoryId: "read",
    startedAt: "2026-08-21T02:00:00.000Z",
    minutes: 30,
    memo: "  집중이 잘 됐다  ",
  });

  assert.equal(edited.sessions[0]?.memo, "집중이 잘 됐다");
  assert.equal(edited.sessions[0]?.memoCaptureState, "saved");
  assert.ok(edited.sessions[0]?.memoUpdatedAt);
});

test("deleting keeps the record recoverable and restoring clears the tombstone", () => {
  const state = baseState({ sessions: [completedSession()] });
  const deleted = deleteSession(state, "s1");
  assert.equal(deleted.sessions[0]?.status, "deleted");
  assert.ok(deleted.sessions[0]?.deletedAt);
  assert.equal(deleted.sessions[0]?.memoCaptureState, "skipped");

  const restored = restoreSession(deleted, "s1");
  assert.equal(restored.sessions[0]?.status, "completed");
  assert.equal(restored.sessions[0]?.deletedAt, undefined);

  assert.equal(restoreSession(restored, "s1"), restored, "restoring a live session is a no-op");
});

test("editing a Category drops the stored AI headline", () => {
  const state = baseState({
    aiReflection: {
      headline: "조용한 저녁이 이어졌어요",
      factIndex: 0,
      factSnapshot: {
        key: "comparison", type: "최근 대비", message: "m", description: "d", evidence: "e",
        evidenceItems: [], range: 7, periodLabel: "p", fingerprint: "f",
      },
      createdAt: "2026-08-21T00:00:00.000Z",
    },
  });
  const result = upsertCategory(state, { name: "독서 노트", color: "#20D68A", goal: 45, goalType: "daily" }, "read");

  assert.equal(result.state.aiReflection, null, "the headline cited evidence that just moved");
  assert.equal(result.state.categories[0]?.name, "독서 노트");
});

test("switching a Category to daily re-clamps its goal to a day", () => {
  const weekly = upsertCategory(baseState(), { name: "산책", color: "#123456", goal: 3000, goalType: "weekly" }, null);
  const daily = setCategoryGoalType(weekly.state, weekly.categoryId, "daily");
  const category = daily.categories.find((item) => item.id === weekly.categoryId);
  assert.equal(category?.goalType, "daily");
  assert.equal(category?.goal, 720);
});

test("a new Category gets an id, a safe colour and a clamped goal", () => {
  const result = upsertCategory(baseState(), { name: "산책", color: "not-a-colour", goal: 99999, goalType: "weekly" }, null);
  const created = result.state.categories.at(-1);

  assert.equal(created?.name, "산책");
  assert.equal(created?.goal, 5040, "a week cannot hold more than seven maxed days");
  assert.equal(created?.goalType, "weekly");
  assert.match(created?.color ?? "", /^#[0-9A-Fa-f]{6}$/);
  assert.equal(created?.status, "active");
  assert.equal(result.categoryId, created?.id);
});

test("duplicate Category names are detected regardless of case and spacing", () => {
  const state = baseState();
  assert.equal(isDuplicateCategoryName(state, "  독서 ", null), true);
  assert.equal(isDuplicateCategoryName(state, "독서", "read"), false, "renaming itself is not a duplicate");
  assert.equal(isDuplicateCategoryName(state, "명상", null), false);
});

test("archiving toggles both ways and ignores unknown ids", () => {
  const archived = toggleArchiveCategory(baseState(), "read");
  assert.equal(archived.categories[0]?.status, "archived");
  assert.equal(toggleArchiveCategory(archived, "read").categories[0]?.status, "active");

  const state = baseState();
  assert.equal(toggleArchiveCategory(state, "ghost"), state);
});
