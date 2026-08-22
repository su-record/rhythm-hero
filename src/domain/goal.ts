import { todayMinutes } from "./stats.ts";
import { weekMinutes } from "./week.ts";
import type { AppState, Category, GoalType } from "./types.ts";

export function goalTypeOf(category: Category): GoalType {
  return category.goalType === "weekly" ? "weekly" : "daily";
}

export const GOAL_TYPE_LABEL: Record<GoalType, string> = { daily: "하루", weekly: "한 주" };

/** The daily-sized share of a goal, for day-level displays like the heatmap. */
export function dailyShareOfGoal(category: Category): number {
  if (!category.goal) return 0;
  return goalTypeOf(category) === "weekly" ? category.goal / 7 : category.goal;
}

export function describeGoal(category: Category): string {
  if (!category.goal) return "목표 없이 기록";
  return goalTypeOf(category) === "weekly" ? `한 주 ${category.goal}분` : `오늘 목표 ${category.goal}분`;
}

export interface GoalStanding {
  /** Minutes in the goal's own period: today for daily, this week for weekly. */
  minutes: number;
  ratio: number;
  complete: boolean;
  periodLabel: "오늘" | "이번 주";
}

export function goalStanding(state: AppState, category: Category, now: Date = new Date()): GoalStanding {
  const weekly = goalTypeOf(category) === "weekly";
  const minutes = weekly ? weekMinutes(state, category.id, now) : todayMinutes(state, category.id, now);
  const ratio = category.goal ? Math.min(1, minutes / category.goal) : Math.min(1, minutes / (weekly ? 420 : 60));
  return { minutes, ratio, complete: Boolean(category.goal && minutes >= category.goal), periodLabel: weekly ? "이번 주" : "오늘" };
}
