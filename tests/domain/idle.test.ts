import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_COMPANION, checkIdle, pickNudgeLine } from "../../src/domain/idle.ts";
import type { AppState, Session } from "../../src/domain/types.ts";

function at(hour: number, minute = 0): Date {
  return new Date(2026, 7, 22, hour, minute, 0, 0);
}

function completed(id: string, categoryId: string, endHour: number, endMinute = 0): Session {
  const end = at(endHour, endMinute);
  return {
    id,
    categoryId,
    startedAt: new Date(end.getTime() - 30 * 60_000).toISOString(),
    endedAt: end.toISOString(),
    source: "device",
    status: "completed",
  };
}

function state(overrides: Partial<AppState> = {}): AppState {
  return {
    companion: { ...DEFAULT_COMPANION },
    categories: [
      { id: "read", name: "독서", color: "#20D68A", goal: 60, status: "active" },
      { id: "move", name: "운동", color: "#FF5D52", goal: 20, status: "active" },
    ],
    assignments: ["read", "move"],
    sessions: [],
    activeSession: null,
    historyRange: 7,
    reflectionRange: 7,
    aiReflection: null,
    updatedAt: at(9).toISOString(),
    ...overrides,
  };
}

test("a quiet morning counts from the start of waking hours", () => {
  assert.equal(checkIdle(state(), DEFAULT_COMPANION, at(9, 29)).idle, false, "89 minutes after 08:00 is not yet idle");
  assert.equal(checkIdle(state(), DEFAULT_COMPANION, at(9, 30)).idle, true, "90 minutes after 08:00 is idle");
});

test("the toy stays quiet outside waking hours", () => {
  assert.equal(checkIdle(state(), DEFAULT_COMPANION, at(7, 59)).idle, false);
  assert.equal(checkIdle(state(), DEFAULT_COMPANION, at(23, 0)).idle, false);
  assert.equal(checkIdle(state(), DEFAULT_COMPANION, at(2, 0)).idle, false);
});

test("a running session is never idle", () => {
  const running = state({
    activeSession: { id: "live", categoryId: "read", startedAt: at(9).toISOString(), source: "device", status: "running" },
  });
  assert.equal(checkIdle(running, DEFAULT_COMPANION, at(14)).idle, false);
});

test("idle is measured from the end of the last completed record today", () => {
  const withRecord = state({ sessions: [completed("a", "read", 12, 0)] });
  const before = checkIdle(withRecord, DEFAULT_COMPANION, at(13, 29));
  const after = checkIdle(withRecord, DEFAULT_COMPANION, at(13, 30));

  assert.equal(before.idle, false);
  assert.equal(after.idle, true);
  assert.equal(after.quietMinutes, 90);
  assert.equal(after.lastCategory?.id, "read");
});

test("the threshold comes from the user's companion settings", () => {
  const quick = { voice: true, idleMinutes: 1 };
  assert.equal(checkIdle(state(), quick, at(8, 1)).idle, true, "a 1 minute threshold is what a demo needs");
});

test("yesterday's record does not count as today's activity", () => {
  const yesterday = completed("old", "read", 20);
  const shifted = new Date(yesterday.endedAt ?? 0);
  shifted.setDate(shifted.getDate() - 1);
  const withOld = state({ sessions: [{ ...yesterday, endedAt: shifted.toISOString() }] });
  const check = checkIdle(withOld, DEFAULT_COMPANION, at(10));

  assert.equal(check.idle, true);
  assert.equal(check.lastCategory, null, "a day-old record is not what the nudge should refer to");
});

test("the nudge names the last activity and suggests a different one with a small ask", () => {
  const withRecord = state({ sessions: [completed("a", "read", 12, 0)] });
  const check = checkIdle(withRecord, DEFAULT_COMPANION, at(14, 0));
  const line = pickNudgeLine(withRecord, check, at(14, 0), 0);

  assert.match(line, /독서 끝낸 지 2시간 됐어/);
  assert.match(line, /운동 20분 어때\?/, "a short goal is used as the ask; otherwise 15 minutes");
});

test("with no record yet the nudge opens with the time of day", () => {
  const check = checkIdle(state(), DEFAULT_COMPANION, at(10));
  const morning = pickNudgeLine(state(), check, at(10), 0);
  const evening = pickNudgeLine(state(), check, at(20), 0);

  assert.match(morning, /아침/);
  assert.match(evening, /저녁|하루/);
  assert.match(morning, /독서 15분 어때\?/);
});

test("a forced nudge right after a record does not say 'zero minutes ago'", () => {
  const withRecord = state({ sessions: [completed("a", "read", 14, 0)] });
  const check = checkIdle(withRecord, DEFAULT_COMPANION, at(14, 2));
  const line = pickNudgeLine(withRecord, check, at(14, 2), 0);

  assert.doesNotMatch(line, /끝낸 지/, "the elapsed-time phrasing is skipped under ten minutes");
  assert.match(line, /운동 20분 어때\?/, "it still suggests something other than what was just done");
});

test("the nudge never scolds", () => {
  const check = checkIdle(state(), DEFAULT_COMPANION, at(15));
  for (const pick of [0, 0.5, 0.99]) {
    const line = pickNudgeLine(state(), check, at(15), pick);
    assert.doesNotMatch(line, /왜|실패|게을|안 했|해야/, `"${line}" reads like a coach, not a toy`);
  }
});
