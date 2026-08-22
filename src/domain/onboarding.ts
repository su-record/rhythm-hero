import { randomId } from "./state.ts";
import type { AppState, Category, GoalType, Profile } from "./types.ts";

export const MAX_ACTIVITIES = 4;
export const MAX_ACTIVITY_NAME = 20;

/** Starting points for "what matters to you": common, concrete, and easy to say no to. */
export const SUGGESTED_ACTIVITIES = ["운동", "독서", "공부", "글쓰기", "프로젝트", "음악", "명상", "산책", "요리", "가족", "영어", "그림"];

/** Brand four first, then companions in the same saturation, so four picks always read as the board's four. */
export const ACTIVITY_PALETTE = ["#FF5D52", "#20D68A", "#5B70FF", "#FFD43B", "#FF8FAB", "#7C5CFF", "#00B8D9", "#F28B2F"];

export const GOAL_PRESETS: Record<GoalType, number[]> = {
  daily: [15, 30, 60, 90],
  weekly: [120, 300, 600, 900],
};

export interface ActivityDraft {
  name: string;
  goalType: GoalType;
  goal: number;
}

export function normalizeActivityName(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_ACTIVITY_NAME);
}

/** Picks are unique by name, case-insensitively, and capped at the board's four buttons. */
export function addActivity(drafts: ActivityDraft[], rawName: string): ActivityDraft[] {
  const name = normalizeActivityName(rawName);
  if (!name || drafts.length >= MAX_ACTIVITIES) return drafts;
  if (drafts.some((draft) => draft.name.toLocaleLowerCase("ko-KR") === name.toLocaleLowerCase("ko-KR"))) return drafts;
  return [...drafts, { name, goalType: "daily", goal: 30 }];
}

export function removeActivity(drafts: ActivityDraft[], name: string): ActivityDraft[] {
  return drafts.filter((draft) => draft.name !== name);
}

export function setActivityGoal(drafts: ActivityDraft[], name: string, goalType: GoalType, goal: number): ActivityDraft[] {
  const limit = goalType === "weekly" ? 5040 : 720;
  return drafts.map((draft) => (draft.name === name ? { ...draft, goalType, goal: Math.max(0, Math.min(limit, Math.round(goal) || 0)) } : draft));
}

export function buildCategories(drafts: ActivityDraft[]): Category[] {
  return drafts.slice(0, MAX_ACTIVITIES).map((draft, index) => ({
    id: randomId(),
    name: draft.name,
    color: ACTIVITY_PALETTE[index % ACTIVITY_PALETTE.length] ?? ACTIVITY_PALETTE[0]!,
    goal: draft.goal,
    goalType: draft.goalType,
    status: "active",
  }));
}

/**
 * A finished onboarding replaces the demo seed with the person's own four and
 * starts their record empty. Nothing of the demo should look like their life.
 */
export function completeOnboarding(state: AppState, profile: Profile, drafts: ActivityDraft[]): AppState {
  const categories = buildCategories(drafts);
  if (!categories.length) throw new Error("Onboarding needs at least one activity");
  return {
    ...state,
    profile,
    categories,
    assignments: categories.map((category) => category.id),
    sessions: [],
    activeSession: null,
    aiReflection: null,
  };
}
