import { minutesFor, sessionsForDay, todayMinutes } from "./stats.ts";
import { sameLocalDay } from "./time.ts";
import type { AppState, Category } from "./types.ts";

/** Monday-first weeks, the way Korean calendars run. */
export function weekStart(now: Date = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  return start;
}

export function weekDaysSoFar(now: Date = new Date()): Date[] {
  const start = weekStart(now);
  const days: Date[] = [];
  for (let index = 0; index < 7; index += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    day.setHours(12, 0, 0, 0);
    if (day.getTime() > now.getTime() && !sameLocalDay(day, now)) break;
    days.push(day);
  }
  return days;
}

export function weekMinutes(state: AppState, categoryId: string, now: Date = new Date()): number {
  return weekDaysSoFar(now).reduce((sum, day) => {
    if (sameLocalDay(day, now)) return sum + todayMinutes(state, categoryId, now);
    return sum + minutesFor(categoryId, sessionsForDay(state, day));
  }, 0);
}

export interface WeeklyProgress {
  category: Category;
  minutes: number;
  goal: number;
  ratio: number;
  /** Minutes still needed, spread over the days left including today. */
  perDayLeft: number;
  done: boolean;
}

export function daysLeftInWeek(now: Date = new Date()): number {
  return 7 - weekDaysSoFar(now).length + 1;
}

/** Only categories with a weekly goal appear; the rest have nothing to report. */
export function weeklyProgress(state: AppState, now: Date = new Date()): WeeklyProgress[] {
  const left = daysLeftInWeek(now);
  return state.categories
    .filter((category) => category.status !== "archived" && (category.weeklyGoal ?? 0) > 0)
    .map((category) => {
      const goal = category.weeklyGoal ?? 0;
      const minutes = weekMinutes(state, category.id, now);
      const remaining = Math.max(0, goal - minutes);
      return { category, minutes, goal, ratio: Math.min(1, minutes / goal), perDayLeft: remaining / left, done: remaining === 0 };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

export function describeWeek(progress: WeeklyProgress[], now: Date = new Date()): string {
  if (!progress.length) return "주간 목표를 정하면 여기서 한 주를 따라가요.";
  const done = progress.filter((item) => item.done).length;
  const left = daysLeftInWeek(now);
  if (done === progress.length) return "이번 주 목표를 전부 채웠어요.";
  return `${done}/${progress.length} 채움 · ${left === 1 ? "오늘이 마지막 날" : `${left}일 남음`}`;
}
