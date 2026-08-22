import { completeActiveSession, createDefaultState, isDuplicateCategoryName, randomId, updateSessionMemo } from "../domain/state.ts";
import { categoryById } from "../domain/stats.ts";
import { safeColor } from "../domain/format.ts";
import { endTimeFor } from "../domain/time.ts";
import type { AppState, Category, MemoCaptureState, PeriodRange, Session, SessionSource } from "../domain/types.ts";

export { isDuplicateCategoryName };

/** Transitions return the next state plus what the view needs to react to. */
export interface StartOutcome {
  state: AppState;
  started: Category | null;
  alreadyRunning: Category | null;
}

export function startSession(state: AppState, categoryId: string, source: SessionSource): StartOutcome {
  const category = categoryById(state, categoryId);
  if (!category) return { state, started: null, alreadyRunning: null };
  if (state.activeSession) {
    return { state, started: null, alreadyRunning: categoryById(state, state.activeSession.categoryId) ?? null };
  }
  const activeSession = {
    id: randomId(),
    categoryId,
    startedAt: new Date().toISOString(),
    source,
    status: "running" as const,
  };
  return { state: { ...state, activeSession }, started: category, alreadyRunning: null };
}

export function stopSession(state: AppState): { state: AppState; completedSession: Session | null } {
  return completeActiveSession(state);
}

export type ButtonOutcome =
  | { kind: "unassigned" }
  | { kind: "started"; category: Category }
  | { kind: "stopped"; session: Session }
  | { kind: "switched"; session: Session; category: Category };

export function pressButton(state: AppState, index: number): { state: AppState; outcome: ButtonOutcome } {
  const categoryId = state.assignments[index - 1];
  if (!categoryId) return { state, outcome: { kind: "unassigned" } };
  if (!state.activeSession) {
    const start = startSession(state, categoryId, "device");
    return start.started
      ? { state: start.state, outcome: { kind: "started", category: start.started } }
      : { state, outcome: { kind: "unassigned" } };
  }
  const stopped = stopSession(state);
  if (!stopped.completedSession) return { state, outcome: { kind: "unassigned" } };
  if (state.activeSession.categoryId === categoryId) {
    return { state: stopped.state, outcome: { kind: "stopped", session: stopped.completedSession } };
  }
  const restarted = startSession(stopped.state, categoryId, "device");
  return restarted.started
    ? { state: restarted.state, outcome: { kind: "switched", session: stopped.completedSession, category: restarted.started } }
    : { state: stopped.state, outcome: { kind: "stopped", session: stopped.completedSession } };
}

export function settleMemo(state: AppState, sessionId: string, memo: string, captureState: MemoCaptureState): AppState {
  return updateSessionMemo(state, sessionId, memo, captureState).state;
}

function mapSession(state: AppState, id: string, change: (session: Session) => Session): AppState {
  let changed = false;
  const sessions = state.sessions.map((session) => {
    if (session.id !== id) return session;
    changed = true;
    return change(session);
  });
  return changed ? { ...state, sessions } : state;
}

export interface SessionEdit {
  categoryId: string;
  startedAt: string;
  minutes: number;
  memo: string;
}

const MAX_SESSION_MINUTES = 720;

export function editSession(state: AppState, id: string, edit: SessionEdit): AppState {
  const minutes = Math.min(MAX_SESSION_MINUTES, edit.minutes);
  const startedAt = new Date(edit.startedAt);
  const updatedAt = new Date().toISOString();
  const memo = edit.memo.trim();
  return mapSession(state, id, (session) => ({
    ...session,
    categoryId: edit.categoryId,
    startedAt: startedAt.toISOString(),
    endedAt: endTimeFor(startedAt, minutes),
    memo,
    memoCaptureState: memo ? "saved" : session.memoCaptureState === "pending" ? "skipped" : session.memoCaptureState,
    ...(memo ? { memoUpdatedAt: updatedAt } : {}),
    updatedAt,
  }));
}

export function deleteSession(state: AppState, id: string): AppState {
  const deletedAt = new Date().toISOString();
  return mapSession(state, id, (session) => ({
    ...session,
    status: "deleted",
    deletedAt,
    memoCaptureState: session.memoCaptureState === "pending" ? "skipped" : session.memoCaptureState,
  }));
}

export function restoreSession(state: AppState, id: string): AppState {
  const session = state.sessions.find((item) => item.id === id);
  if (!session || session.status !== "deleted") return state;
  return mapSession(state, id, ({ deletedAt: _deletedAt, ...rest }) => ({
    ...rest,
    status: "completed",
    updatedAt: new Date().toISOString(),
  }));
}

export function toggleArchiveCategory(state: AppState, id: string): AppState {
  const category = categoryById(state, id);
  if (!category) return state;
  const nextStatus = category.status === "archived" ? "active" : "archived";
  return {
    ...state,
    categories: state.categories.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)),
  };
}

export interface CategoryDraft {
  name: string;
  color: string;
  goal: number;
}

const MAX_GOAL_MINUTES = 720;

/** Editing a Category invalidates the stored AI headline: its evidence moved. */
export function upsertCategory(state: AppState, draft: CategoryDraft, editingId: string | null): { state: AppState; categoryId: string } {
  const color = safeColor(draft.color);
  const goal = Math.max(0, Math.min(MAX_GOAL_MINUTES, Number(draft.goal) || 0));
  if (editingId) {
    return {
      state: {
        ...state,
        aiReflection: null,
        categories: state.categories.map((item) => (item.id === editingId ? { ...item, name: draft.name, color, goal } : item)),
      },
      categoryId: editingId,
    };
  }
  const category: Category = { id: randomId(), name: draft.name, color, goal, status: "active" };
  return { state: { ...state, categories: [...state.categories, category] }, categoryId: category.id };
}

export function setCategoryGoal(state: AppState, id: string, goal: number): AppState {
  const clamped = Math.max(0, Math.min(MAX_GOAL_MINUTES, Number(goal) || 0));
  return { ...state, categories: state.categories.map((item) => (item.id === id ? { ...item, goal: clamped } : item)) };
}

export function setHistoryRange(state: AppState, range: PeriodRange): AppState {
  return state.historyRange === range ? state : { ...state, historyRange: range };
}

export function setReflectionRange(state: AppState, range: PeriodRange): AppState {
  return state.reflectionRange === range ? state : { ...state, reflectionRange: range };
}

export function setAiReflection(state: AppState, aiReflection: AppState["aiReflection"]): AppState {
  return { ...state, aiReflection };
}

export function resetDemo(): AppState {
  return createDefaultState();
}
