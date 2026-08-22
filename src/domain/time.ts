import type { ActiveSession, DaySession, PeriodBounds, PeriodRange, Session } from "./types.ts";

type TimedSession = Pick<Session, "startedAt" | "endedAt"> | ActiveSession;

export function dayBounds(day: Date): { start: Date; end: Date } {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function overlapMsForDay(session: TimedSession, day: Date, end: Date = new Date()): number {
  const { start, end: dayEnd } = dayBounds(day);
  const sessionStart = new Date(session.startedAt).getTime();
  const sessionEnd = new Date(("endedAt" in session && session.endedAt) || end).getTime();
  return Math.max(0, Math.min(sessionEnd, dayEnd.getTime()) - Math.max(sessionStart, start.getTime()));
}

export function overlapMsForPeriod(session: Session, bounds: PeriodBounds): number {
  const sessionStart = new Date(session.startedAt).getTime();
  const sessionEnd = new Date(session.endedAt || session.startedAt).getTime();
  return Math.max(0, Math.min(sessionEnd, bounds.end.getTime()) - Math.max(sessionStart, bounds.start.getTime()));
}

/** A day-narrowed session reports that day's share; anything else reports its full span. */
export function durationMs(session: TimedSession | DaySession, end: Date = new Date()): number {
  if ("dayDurationMs" in session && Number.isFinite(session.dayDurationMs)) return session.dayDurationMs;
  return new Date(("endedAt" in session && session.endedAt) || end).getTime() - new Date(session.startedAt).getTime();
}

export function periodBounds(range: PeriodRange, offsetPeriods = 0): PeriodBounds {
  const safeRange: PeriodRange = range === 30 ? 30 : 7;
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1 - safeRange * offsetPeriods);
  const start = new Date(end);
  start.setDate(start.getDate() - safeRange);
  return { start, end, range: safeRange };
}

/** Noon anchored so daylight-saving shifts cannot roll a day over its boundary. */
export function recentDays(range: number): Date[] {
  return Array.from({ length: range }, (_, index) => {
    const day = new Date();
    day.setHours(12, 0, 0, 0);
    day.setDate(day.getDate() - (range - 1 - index));
    return day;
  });
}

export function sameLocalDay(a: Date | string, b: Date | string = new Date()): boolean {
  const left = new Date(a);
  const right = new Date(b);
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

export function dayKey(value: Date | string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function localDateInput(value: Date | string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function localTimeInput(value: Date | string): string {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** The end timestamp for a session of a given length, as the edit dialog states it. */
export function endTimeFor(startedAt: Date | string, minutes: number): string {
  return new Date(new Date(startedAt).getTime() + minutes * 60_000).toISOString();
}
