import test from "node:test";
import assert from "node:assert/strict";

import { buildDayCard, buildDayCards, deriveRoutine, describeRoutine } from "../../src/domain/routine.ts";
import type { AppState, Session } from "../../src/domain/types.ts";

const NOW = new Date(2026, 7, 22, 15, 0, 0, 0);

function on(daysAgo: number, hour: number, minute = 0): Date {
  const date = new Date(NOW);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function session(id: string, categoryId: string, daysAgo: number, hour: number, minutes: number, memo?: string): Session {
  const start = on(daysAgo, hour);
  return {
    id,
    categoryId,
    startedAt: start.toISOString(),
    endedAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
    source: "device",
    status: "completed",
    ...(memo ? { memo } : {}),
  };
}

function state(sessions: Session[], overrides: Partial<AppState> = {}): AppState {
  return {
    profile: null,
    companion: { voice: true, idleMinutes: 90 },
    categories: [
      { id: "move", name: "운동", color: "#FF5D52", goal: 30, status: "active" },
      { id: "read", name: "독서", color: "#20D68A", goal: 60, status: "active" },
    ],
    assignments: ["move", "read"],
    sessions,
    activeSession: null,
    historyRange: 7,
    reflectionRange: 7,
    aiReflection: null,
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

test("the deck starts with today and walks back one card per day", () => {
  const cards = buildDayCards(state([]), 7, NOW);
  assert.equal(cards.length, 7);
  assert.equal(cards[0]?.isToday, true);
  assert.equal(cards[1]?.isToday, false);
  assert.ok((cards[0]?.day.getTime() ?? 0) > (cards[6]?.day.getTime() ?? 0), "later cards are earlier days");
});

test("a day with no record is quiet, with a record it moves, with a goal met it is full", () => {
  assert.equal(buildDayCard(state([]), on(0, 12), NOW).mood, "quiet");
  assert.equal(buildDayCard(state([session("a", "read", 0, 9, 20)]), on(0, 12), NOW).mood, "moving");
  assert.equal(buildDayCard(state([session("a", "move", 0, 9, 30)]), on(0, 12), NOW).mood, "full");
});

test("segments sit on a 06–24 timeline as fractions, sorted by start", () => {
  const card = buildDayCard(state([session("late", "read", 0, 21, 60), session("early", "move", 0, 9, 30)]), on(0, 12), NOW);

  assert.deepEqual(card.segments.map((segment) => segment.sessionId), ["early", "late"]);
  const early = card.segments[0];
  assert.ok(Math.abs((early?.start ?? 0) - 3 / 18) < 1e-9, "09:00 is 3 hours into an 18 hour window");
  assert.ok(Math.abs((early?.end ?? 0) - 3.5 / 18) < 1e-9);
});

test("a session that started before 06:00 clamps to the left edge instead of disappearing", () => {
  const card = buildDayCard(state([session("dawn", "read", 0, 4, 180)]), on(0, 12), NOW);
  assert.equal(card.segments[0]?.start, 0);
  assert.ok((card.segments[0]?.end ?? 0) > 0);
  assert.equal(card.totalMinutes, 180, "the minutes still count in full");
});

test("a running session appears on today's card, extends to now, and counts toward the total", () => {
  const running = state([], {
    activeSession: { id: "live", categoryId: "move", startedAt: on(0, 14, 30).toISOString(), source: "device", status: "running" },
  });
  const card = buildDayCard(running, on(0, 12), NOW);

  assert.equal(card.segments.length, 1);
  assert.equal(card.segments[0]?.running, true);
  assert.ok(Math.abs((card.segments[0]?.end ?? 0) - 9 / 18) < 1e-9, "15:00 is the right edge of the running segment");
  assert.equal(card.totalMinutes, 30);
  assert.equal(card.mood, "full", "30 minutes meets the 30 minute goal even while running");
});

test("shares are ordered by minutes and carry a goal ratio", () => {
  const card = buildDayCard(state([session("a", "read", 0, 9, 30), session("b", "move", 0, 10, 15)]), on(0, 12), NOW);
  assert.deepEqual(card.shares.map((share) => share.category.id), ["read", "move"]);
  assert.equal(card.shares[0]?.goalRatio, 0.5);
  assert.equal(card.shares[1]?.goalRatio, 0.5);
});

test("the card surfaces the latest memo of the day", () => {
  const card = buildDayCard(state([
    session("a", "read", 0, 9, 30, "3장까지"),
    session("b", "move", 0, 11, 15, "가볍게 걸었다"),
  ]), on(0, 12), NOW);
  assert.equal(card.memo, "가볍게 걸었다");
});

test("a routine is a category that repeats in the same part of the day", () => {
  const patterns = deriveRoutine(state([
    session("m1", "move", 1, 7, 20),
    session("m2", "move", 2, 8, 20),
    session("m3", "move", 3, 7, 20),
    session("r1", "read", 1, 22, 30),
    session("r2", "read", 3, 21, 30),
    session("once", "read", 2, 13, 30),
  ]), 7, NOW);

  assert.deepEqual(patterns.map((pattern) => [pattern.category.id, pattern.band, pattern.days]), [["move", "아침", 3], ["read", "밤", 2]]);
  assert.equal(describeRoutine(patterns), "아침 운동 · 밤 독서");
});

test("one appearance is not a routine yet", () => {
  const patterns = deriveRoutine(state([session("m1", "move", 1, 7, 20)]), 7, NOW);
  assert.deepEqual(patterns, []);
  assert.match(describeRoutine(patterns), /찾는 중/);
});
