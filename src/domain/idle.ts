import { categoryById } from "./stats.ts";
import type { AppState, Category, CompanionSettings, Session } from "./types.ts";

export const DEFAULT_COMPANION: CompanionSettings = { voice: true, idleMinutes: 90 };

/** The toy only speaks while a person is plausibly awake. */
export const WAKING_HOURS = { start: 8, end: 23 };

export interface IdleCheck {
  idle: boolean;
  /** Minutes since the last completed session ended, or null when there is none today. */
  quietMinutes: number | null;
  lastCategory: Category | null;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function lastCompletedToday(state: AppState, now: Date): Session | null {
  const today = state.sessions
    .filter((session) => session.status === "completed" && session.endedAt && sameDay(new Date(session.endedAt), now))
    .sort((left, right) => new Date(right.endedAt ?? 0).getTime() - new Date(left.endedAt ?? 0).getTime());
  return today[0] ?? null;
}

/**
 * Idle means: awake hours, nothing running, and either no record yet today
 * or the last one ended more than idleMinutes ago. The first-record case
 * uses the start of waking hours as its anchor so a quiet morning counts.
 */
export function checkIdle(state: AppState, settings: CompanionSettings, now: Date = new Date()): IdleCheck {
  const hour = now.getHours();
  const awake = hour >= WAKING_HOURS.start && hour < WAKING_HOURS.end;
  if (!awake || state.activeSession) return { idle: false, quietMinutes: null, lastCategory: null };

  const last = lastCompletedToday(state, now);
  const anchor = last ? new Date(last.endedAt ?? now) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), WAKING_HOURS.start);
  const quietMinutes = Math.max(0, (now.getTime() - anchor.getTime()) / 60_000);
  return {
    idle: quietMinutes >= settings.idleMinutes,
    quietMinutes: last ? quietMinutes : null,
    lastCategory: last ? categoryById(state, last.categoryId) ?? null : null,
  };
}

type TimeBand = "morning" | "afternoon" | "evening";

function timeBand(now: Date): TimeBand {
  const hour = now.getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

const OPENERS: Record<TimeBand, string[]> = {
  morning: ["좋은 아침! 오늘은 아직 조용하네.", "아침인데 나 심심해."],
  afternoon: ["오후가 반이나 지났는데 조용하네?", "점심은 먹었어? 나는 심심해."],
  evening: ["저녁이야. 오늘 하루 조용했네.", "하루가 거의 끝나가. 뭐 하나만 해볼까?"],
};

/**
 * A nudge line in the voice of a bored toy, never a coach. It names a concrete,
 * small next step from the user's own Active 4 so the ask feels doable.
 */
export function pickNudgeLine(state: AppState, check: IdleCheck, now: Date = new Date(), pick: number = Math.random()): string {
  const band = timeBand(now);
  const openers = OPENERS[band];
  const opener = openers[Math.floor(pick * openers.length)] ?? openers[0] ?? "";
  const suggestion = suggestCategory(state, check.lastCategory);
  if (!suggestion) return opener;
  const minutes = suggestion.goal && suggestion.goal < 30 ? suggestion.goal : 15;
  // Under ten quiet minutes the "since" phrasing sounds absurd; use the opener instead.
  if (check.lastCategory && check.quietMinutes !== null && check.quietMinutes >= 10) {
    const hours = Math.floor(check.quietMinutes / 60);
    const since = hours >= 1 ? `${hours}시간` : `${Math.round(check.quietMinutes)}분`;
    return `${check.lastCategory.name} 끝낸 지 ${since} 됐어. ${suggestion.name} ${minutes}분 어때?`;
  }
  return `${opener} ${suggestion.name} ${minutes}분 어때?`;
}

/** Prefer an Active 4 category the user hasn't touched today, else any active one. */
function suggestCategory(state: AppState, lastCategory: Category | null): Category | null {
  const candidates = state.assignments
    .map((id) => categoryById(state, id))
    .filter((category): category is Category => Boolean(category) && category?.status !== "archived");
  const untouched = candidates.find((category) => category.id !== lastCategory?.id);
  return untouched ?? candidates[0] ?? null;
}
