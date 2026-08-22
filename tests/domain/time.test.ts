import test from "node:test";
import assert from "node:assert/strict";

import { dayKey, durationMs, localDateInput, localTimeInput, overlapMsForDay, periodBounds, recentDays, sameLocalDay } from "../../src/domain/time.ts";
import { formatClock, formatMinutes } from "../../src/domain/format.ts";
import type { Session } from "../../src/domain/types.ts";

/** Local-time helpers, so the assertions hold in any timezone the suite runs in. */
function localIso(year: number, month: number, day: number, hour: number, minute: number): string {
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

const MINUTE = 60_000;

test("a session crossing midnight is split across both days", () => {
  const session: Session = {
    id: "night",
    categoryId: "read",
    startedAt: localIso(2026, 8, 21, 23, 40),
    endedAt: localIso(2026, 8, 22, 0, 20),
    source: "app",
    status: "completed",
  };
  const first = new Date(2026, 7, 21, 12, 0, 0, 0);
  const second = new Date(2026, 7, 22, 12, 0, 0, 0);

  assert.equal(overlapMsForDay(session, first) / MINUTE, 20);
  assert.equal(overlapMsForDay(session, second) / MINUTE, 20);
  assert.equal(durationMs(session) / MINUTE, 40, "the untrimmed session still reports its full span");
});

test("a session outside the day contributes nothing", () => {
  const session: Session = {
    id: "away",
    categoryId: "read",
    startedAt: localIso(2026, 8, 19, 9, 0),
    endedAt: localIso(2026, 8, 19, 10, 0),
    source: "app",
    status: "completed",
  };
  assert.equal(overlapMsForDay(session, new Date(2026, 7, 21, 12, 0, 0, 0)), 0);
});

test("a running session is measured up to the supplied end", () => {
  const running = { id: "live", categoryId: "read", startedAt: localIso(2026, 8, 21, 9, 0), source: "device" as const, status: "running" as const };
  const now = new Date(2026, 7, 21, 9, 25, 0, 0);
  assert.equal(durationMs(running, now) / MINUTE, 25);
  assert.equal(overlapMsForDay(running, now, now) / MINUTE, 25);
});

test("a day-narrowed session reports that day's share, not its whole span", () => {
  const narrowed = {
    id: "night",
    categoryId: "read",
    startedAt: localIso(2026, 8, 21, 23, 40),
    endedAt: localIso(2026, 8, 22, 0, 20),
    source: "app" as const,
    status: "completed" as const,
    dayDurationMs: 20 * MINUTE,
  };
  assert.equal(durationMs(narrowed) / MINUTE, 20);
});

test("period bounds cover whole days and step back by full periods", () => {
  const current = periodBounds(7);
  const previous = periodBounds(7, 1);

  assert.equal((current.end.getTime() - current.start.getTime()) / (24 * 60 * MINUTE), 7);
  assert.equal(current.start.getTime(), previous.end.getTime(), "the periods are adjacent with no gap or overlap");
  assert.equal(periodBounds(30).range, 30);
  assert.equal(periodBounds(99 as 7).range, 7, "an unexpected range falls back to 7 days");
});

test("recentDays ends on today and is anchored at noon", () => {
  const days = recentDays(7);
  assert.equal(days.length, 7);
  assert.ok(sameLocalDay(days[6] as Date), "the last entry is today");
  assert.equal((days[6] as Date).getHours(), 12, "noon anchoring keeps DST shifts from rolling the day over");
});

test("local formatters use the viewer's calendar day", () => {
  const value = new Date(2026, 7, 5, 9, 7, 0, 0);
  assert.equal(localDateInput(value), "2026-08-05");
  assert.equal(localTimeInput(value), "09:07");
  assert.equal(dayKey(value), "2026-7-5");
  assert.ok(sameLocalDay(value, new Date(2026, 7, 5, 23, 59, 0, 0)));
});

test("durations read the way the app displays them", () => {
  assert.equal(formatMinutes(0.4), "1분 미만");
  assert.equal(formatMinutes(59), "59분");
  assert.equal(formatMinutes(60), "1시간");
  assert.equal(formatMinutes(95), "1시간 35분");
  assert.equal(formatMinutes(-5), "1분 미만");
  assert.equal(formatClock(3 * 3600_000 + 4 * 60_000 + 5000), "03:04:05");
  assert.equal(formatClock(-1), "00:00:00");
});
