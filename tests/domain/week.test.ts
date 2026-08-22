import test from "node:test";
import assert from "node:assert/strict";

import { daysLeftInWeek, describeWeek, weekDaysSoFar, weekMinutes, weekStart, weeklyProgress } from "../../src/domain/week.ts";
import type { AppState, Session } from "../../src/domain/types.ts";

// 2026-08-22 is a Saturday.
const SAT = new Date(2026, 7, 22, 15, 0, 0, 0);

function on(daysAgo: number, hour: number): Date {
  const d = new Date(SAT); d.setDate(d.getDate() - daysAgo); d.setHours(hour, 0, 0, 0); return d;
}
function session(id: string, categoryId: string, daysAgo: number, hour: number, minutes: number): Session {
  const start = on(daysAgo, hour);
  return { id, categoryId, startedAt: start.toISOString(), endedAt: new Date(start.getTime() + minutes * 60_000).toISOString(), source: "device", status: "completed" };
}
function state(sessions: Session[], overrides: Partial<AppState> = {}): AppState {
  return {
    profile: null,
    companion: { voice: true, idleMinutes: 90 },
    categories: [
      { id: "move", name: "운동", color: "#FF5D52", goal: 30, weeklyGoal: 120, status: "active" },
      { id: "read", name: "독서", color: "#20D68A", goal: 60, weeklyGoal: 0, status: "active" },
      { id: "old", name: "보관", color: "#5B70FF", goal: 10, weeklyGoal: 60, status: "archived" },
    ],
    assignments: ["move", "read"],
    sessions, activeSession: null, historyRange: 7, reflectionRange: 7, aiReflection: null, updatedAt: SAT.toISOString(),
    ...overrides,
  };
}

test("weeks start on Monday and the Saturday view covers six days", () => {
  assert.equal(weekStart(SAT).getDay(), 1);
  assert.equal(weekDaysSoFar(SAT).length, 6);
  assert.equal(daysLeftInWeek(SAT), 2, "Saturday and Sunday remain");
});

test("a Monday morning is a fresh week with one day so far", () => {
  const mon = new Date(2026, 7, 17, 9, 0, 0, 0);
  assert.equal(weekDaysSoFar(mon).length, 1);
  assert.equal(daysLeftInWeek(mon), 7);
});

test("weekly minutes sum this week only and include a running session today", () => {
  const running = state([session("a", "move", 1, 9, 40), session("b", "move", 8, 9, 99)], {
    activeSession: { id: "live", categoryId: "move", startedAt: on(0, 14).toISOString(), source: "device", status: "running" },
  });
  assert.equal(Math.round(weekMinutes(running, "move", SAT)), 100, "40 from Friday + 60 running now; last week's 99 is out");
});

test("progress lists only live categories with a weekly goal, ranked by ratio", () => {
  const progress = weeklyProgress(state([session("a", "move", 2, 9, 60)]), SAT);
  assert.deepEqual(progress.map((item) => item.category.id), ["move"]);
  assert.equal(progress[0]?.ratio, 0.5);
  assert.equal(progress[0]?.perDayLeft, 30, "60 more minutes over the 2 days left");
  assert.equal(progress[0]?.done, false);
});

test("meeting the goal marks it done and the summary counts it", () => {
  const progress = weeklyProgress(state([session("a", "move", 2, 9, 130)]), SAT);
  assert.equal(progress[0]?.done, true);
  assert.equal(progress[0]?.ratio, 1);
  assert.match(describeWeek(progress, SAT), /전부 채웠어요/);
  assert.match(describeWeek(weeklyProgress(state([]), SAT), SAT), /0\/1 채움 · 2일 남음/);
  assert.match(describeWeek([], SAT), /주간 목표를 정하면/);
});
