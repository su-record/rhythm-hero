import { dayKey, durationMs, overlapMsForDay } from "./time.ts";
import type { AppState, Category, DaySession, Session } from "./types.ts";

export function categoryById(state: AppState, id: string): Category | undefined {
  return state.categories.find((category) => category.id === id);
}

export function selectableCategories(state: AppState): Category[] {
  return state.categories.filter((category) => category.status !== "archived");
}

export function allCompleted(state: AppState): Session[] {
  return state.sessions.filter((session) => session.status === "completed");
}

/** Completed sessions clipped to one day, so a session crossing midnight counts on both. */
export function sessionsForDay(state: AppState, day: Date): DaySession[] {
  return allCompleted(state)
    .map((session) => ({ ...session, dayDurationMs: overlapMsForDay(session, day) }))
    .filter((session) => session.dayDurationMs > 0);
}

export function minutesFor(categoryId: string, sessions: Array<Session | DaySession>): number {
  return sessions
    .filter((session) => session.categoryId === categoryId)
    .reduce((sum, session) => sum + durationMs(session) / 60_000, 0);
}

export function todaySessions(state: AppState): DaySession[] {
  return sessionsForDay(state, new Date());
}

export function todayMinutes(state: AppState, categoryId: string): number {
  const completed = minutesFor(categoryId, todaySessions(state));
  if (state.activeSession?.categoryId !== categoryId) return completed;
  return completed + overlapMsForDay(state.activeSession, new Date()) / 60_000;
}

export function totalTodayMinutes(state: AppState): number {
  return state.categories.reduce((sum, category) => sum + todayMinutes(state, category.id), 0);
}

export interface CategoryStats {
  sessions: Session[];
  totalMinutes: number;
  activeDays: number;
  lastSession: Session | null;
}

export function categoryStats(state: AppState, categoryId: string): CategoryStats {
  const sessions = allCompleted(state)
    .filter((session) => session.categoryId === categoryId)
    .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime());
  return {
    sessions,
    totalMinutes: sessions.reduce((sum, session) => sum + durationMs(session) / 60_000, 0),
    activeDays: new Set(sessions.map((session) => dayKey(session.startedAt))).size,
    lastSession: sessions[0] || null,
  };
}

export function recentSessions(state: AppState, limit: number): Session[] {
  return [...allCompleted(state)]
    .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime())
    .slice(0, limit);
}

const RESTORE_WINDOW_MS = 30 * 24 * 60 * 60_000;

export function restorableSessions(state: AppState, now: number = Date.now()): Session[] {
  return state.sessions.filter(
    (session) =>
      session.status === "deleted" &&
      now - new Date(session.deletedAt || session.updatedAt || session.endedAt || session.startedAt).getTime() < RESTORE_WINDOW_MS,
  );
}

export function pendingMemoSessions(state: AppState): Session[] {
  return state.sessions.filter((session) => session.status === "completed" && session.memoCaptureState === "pending");
}
