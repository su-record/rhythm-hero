import { categoryById, minutesFor, sessionsForDay } from "./stats.ts";
import { dayBounds, overlapMsForDay, recentDays, sameLocalDay } from "./time.ts";
import type { AppState, Category, DaySession } from "./types.ts";

/** The visible part of a day on the card timeline. Nothing is lost: earlier or later spans clamp to the edges. */
export const TIMELINE = { startHour: 6, endHour: 24 };

export type DayMood = "quiet" | "moving" | "full";

export interface TimelineSegment {
  sessionId: string;
  category: Category;
  /** 0..1 across the visible timeline. */
  start: number;
  end: number;
  running: boolean;
}

export interface CategoryShareOfDay {
  category: Category;
  minutes: number;
  /** 0..1 of the goal, or null when the category has no goal. */
  goalRatio: number | null;
}

export interface DayCard {
  day: Date;
  isToday: boolean;
  totalMinutes: number;
  mood: DayMood;
  segments: TimelineSegment[];
  shares: CategoryShareOfDay[];
  memo: string | null;
  sessionCount: number;
}

function fractionOfTimeline(value: Date, day: Date): number {
  const { start } = dayBounds(day);
  const hours = (value.getTime() - start.getTime()) / 3_600_000;
  const span = TIMELINE.endHour - TIMELINE.startHour;
  return Math.min(1, Math.max(0, (hours - TIMELINE.startHour) / span));
}

function segmentsFor(state: AppState, day: Date, sessions: DaySession[], now: Date): TimelineSegment[] {
  const { start, end } = dayBounds(day);
  const clampStart = (value: string) => new Date(Math.max(new Date(value).getTime(), start.getTime()));
  const clampEnd = (value: string | undefined, fallback: Date) => new Date(Math.min(new Date(value ?? fallback).getTime(), end.getTime()));

  const completed = sessions.flatMap((session) => {
    const category = categoryById(state, session.categoryId);
    if (!category) return [];
    return [{
      sessionId: session.id,
      category,
      start: fractionOfTimeline(clampStart(session.startedAt), day),
      end: fractionOfTimeline(clampEnd(session.endedAt, now), day),
      running: false,
    }];
  });

  const active = state.activeSession;
  const activeCategory = active ? categoryById(state, active.categoryId) : undefined;
  if (active && activeCategory && overlapMsForDay(active, day, now) > 0) {
    completed.push({
      sessionId: active.id,
      category: activeCategory,
      start: fractionOfTimeline(clampStart(active.startedAt), day),
      end: fractionOfTimeline(clampEnd(undefined, now), day),
      running: true,
    });
  }
  return completed.sort((left, right) => left.start - right.start);
}

/** Mood is about presence, not performance: any record moves, a goal met fills. */
function moodFor(shares: CategoryShareOfDay[], totalMinutes: number): DayMood {
  if (totalMinutes <= 0) return "quiet";
  return shares.some((share) => share.goalRatio !== null && share.goalRatio >= 1) ? "full" : "moving";
}

export function buildDayCard(state: AppState, day: Date, now: Date = new Date()): DayCard {
  const sessions = sessionsForDay(state, day);
  const activeMinutes = state.activeSession && overlapMsForDay(state.activeSession, day, now) > 0
    ? overlapMsForDay(state.activeSession, day, now) / 60_000
    : 0;
  const shares = state.categories
    .map((category) => {
      const minutes = minutesFor(category.id, sessions) + (state.activeSession?.categoryId === category.id ? activeMinutes : 0);
      return { category, minutes, goalRatio: category.goal ? Math.min(1, minutes / category.goal) : null };
    })
    .filter((share) => share.minutes > 0)
    .sort((left, right) => right.minutes - left.minutes);
  const totalMinutes = shares.reduce((sum, share) => sum + share.minutes, 0);
  const latestMemo = [...sessions].reverse().find((session) => session.memo)?.memo ?? null;

  return {
    day,
    isToday: sameLocalDay(day, now),
    totalMinutes,
    mood: moodFor(shares, totalMinutes),
    segments: segmentsFor(state, day, sessions, now),
    shares,
    memo: latestMemo,
    sessionCount: sessions.length + (activeMinutes > 0 ? 1 : 0),
  };
}

/** Today first, then back in time: the deck is swiped into the past. */
export function buildDayCards(state: AppState, days = 7, now: Date = new Date()): DayCard[] {
  return recentDays(days).reverse().map((day) => buildDayCard(state, day, now));
}

export type Band = "아침" | "낮" | "저녁" | "밤";

export interface RoutinePattern {
  category: Category;
  band: Band;
  /** How many of the observed days the category started in that band. */
  days: number;
}

function bandOf(hour: number): Band {
  if (hour < 11) return "아침";
  if (hour < 17) return "낮";
  if (hour < 21) return "저녁";
  return "밤";
}

const MIN_PATTERN_DAYS = 2;

/**
 * A routine is a category that keeps showing up in the same part of the day.
 * Derived, never declared: the user's own records are the only source.
 */
export function deriveRoutine(state: AppState, days = 7, now: Date = new Date()): RoutinePattern[] {
  const counts = new Map<string, Map<Band, Set<string>>>();
  for (const day of recentDays(days)) {
    if (day.getTime() > now.getTime()) continue;
    for (const session of sessionsForDay(state, day)) {
      const band = bandOf(new Date(session.startedAt).getHours());
      const byBand = counts.get(session.categoryId) ?? new Map<Band, Set<string>>();
      const seen = byBand.get(band) ?? new Set<string>();
      seen.add(day.toDateString());
      byBand.set(band, seen);
      counts.set(session.categoryId, byBand);
    }
  }
  const patterns: RoutinePattern[] = [];
  for (const [categoryId, byBand] of counts) {
    const category = categoryById(state, categoryId);
    if (!category) continue;
    const [band, seen] = [...byBand.entries()].sort((left, right) => right[1].size - left[1].size)[0] ?? [];
    if (band && seen && seen.size >= MIN_PATTERN_DAYS) patterns.push({ category, band, days: seen.size });
  }
  const order: Band[] = ["아침", "낮", "저녁", "밤"];
  return patterns.sort((left, right) => order.indexOf(left.band) - order.indexOf(right.band) || right.days - left.days);
}

export function describeRoutine(patterns: RoutinePattern[]): string {
  if (!patterns.length) return "아직 반복되는 리듬을 찾는 중이에요.";
  return patterns.slice(0, 3).map((pattern) => `${pattern.band} ${pattern.category.name}`).join(" · ");
}
