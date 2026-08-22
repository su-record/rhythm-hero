import test from "node:test";
import assert from "node:assert/strict";

import { countdown } from "../../src/domain/goal.ts";
import type { AppState } from "../../src/domain/types.ts";

const NOW = new Date(2026, 7, 22, 15, 0, 0, 0);
function minutesAgo(minutes: number): string { return new Date(NOW.getTime() - minutes * 60_000).toISOString(); }

function state(overrides: Partial<AppState> = {}): AppState {
  return {
    profile: null,
    companion: { voice: true, idleMinutes: 90 },
    categories: [
      { id: "move", name: "운동", color: "#FF5D52", goal: 30, goalType: "daily", status: "active" },
      { id: "write", name: "글쓰기", color: "#5B70FF", goal: 120, goalType: "weekly", status: "active" },
      { id: "free", name: "자유", color: "#20D68A", goal: 0, status: "active" },
    ],
    assignments: ["move", "write", "free"],
    sessions: [],
    activeSession: null,
    historyRange: 7, reflectionRange: 7, aiReflection: null, updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

test("the clock starts at the goal and drains as the session plays", () => {
  const running = state({ activeSession: { id: "s", categoryId: "move", startedAt: minutesAgo(12), source: "device", status: "running" } });
  const clock = countdown(running, running.categories[0]!, NOW);
  assert.equal(clock.hasGoal, true);
  assert.equal(Math.round(clock.remainingMs / 60_000), 18, "30 minute goal minus 12 played");
  assert.equal(clock.overMs, 0);
});

test("earlier records in the period drain it too, and overtime counts up past zero", () => {
  const s = state({
    sessions: [{ id: "a", categoryId: "move", startedAt: minutesAgo(120), endedAt: minutesAgo(95), source: "device", status: "completed" }],
    activeSession: { id: "s", categoryId: "move", startedAt: minutesAgo(9), source: "device", status: "running" },
  });
  const clock = countdown(s, s.categories[0]!, NOW);
  assert.equal(clock.remainingMs, 0, "25 earlier + 9 now is past the 30 minute goal");
  assert.equal(Math.round(clock.overMs / 60_000), 4);
});

test("a weekly goal drains across the week, not just today", () => {
  const s = state({
    sessions: [{ id: "a", categoryId: "write", startedAt: minutesAgo(24 * 60 + 60), endedAt: minutesAgo(24 * 60), source: "app", status: "completed" }],
  });
  assert.equal(Math.round(countdown(s, s.categories[1]!, NOW).remainingMs / 60_000), 60, "120 weekly minus yesterday's 60");
});

test("without a goal there is nothing to count down", () => {
  const clock = countdown(state(), state().categories[2]!, NOW);
  assert.deepEqual(clock, { remainingMs: 0, overMs: 0, hasGoal: false });
});
