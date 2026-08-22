import { DEFAULT_CATEGORY_COLORS, LEGACY_DEFAULT_CATEGORY_COLORS } from "./format.ts";
import type { AppState, Category, MemoCaptureState, PeriodRange, Session } from "./types.ts";

export const STORAGE_KEY = "habit-toy-state-v1";
export const CLIENT_ID_KEY = "habit-toy-client-id-v1";

export function randomId(): string {
  return globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function isoAt(daysAgo: number, hour: number, minute: number, durationMinutes: number): { startedAt: string; endedAt: string } {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  const end = new Date(date.getTime() + durationMinutes * 60_000);
  return { startedAt: date.toISOString(), endedAt: end.toISOString() };
}

const SEED: Array<[number, string, number, number, number]> = [
  [0, "move", 7, 15, 35], [0, "read", 21, 5, 42], [0, "project", 14, 20, 39],
  [1, "read", 21, 20, 54], [1, "music", 19, 10, 18], [1, "project", 10, 0, 63],
  [2, "move", 18, 45, 57], [2, "read", 22, 10, 23], [2, "project", 13, 30, 92],
  [3, "move", 7, 5, 25], [3, "music", 20, 15, 41], [3, "project", 15, 0, 48],
  [4, "read", 20, 50, 67], [4, "music", 18, 30, 16], [4, "project", 11, 20, 74],
  [5, "move", 18, 10, 62], [5, "read", 21, 0, 31], [5, "project", 14, 45, 45],
  [6, "move", 8, 0, 20], [6, "read", 21, 15, 48], [6, "music", 19, 0, 30],
];

export function createDefaultState(): AppState {
  const categories: Category[] = [
    { id: "move", name: "운동", color: DEFAULT_CATEGORY_COLORS.move, goal: 60, status: "active" },
    { id: "read", name: "독서", color: DEFAULT_CATEGORY_COLORS.read, goal: 60, status: "active" },
    { id: "music", name: "음악", color: DEFAULT_CATEGORY_COLORS.music, goal: 45, status: "active" },
    { id: "project", name: "프로젝트", color: DEFAULT_CATEGORY_COLORS.project, goal: 90, status: "active" },
  ];
  const sessions: Session[] = SEED.map(([daysAgo, categoryId, hour, minute, duration], index) => ({
    id: `seed-${index}`,
    categoryId,
    ...isoAt(daysAgo, hour, minute, duration),
    source: "device",
    status: "completed",
  }));
  return {
    categories,
    assignments: ["move", "read", "music", "project"],
    sessions,
    activeSession: null,
    historyRange: 7,
    reflectionRange: 7,
    aiReflection: null,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeRange(value: unknown, fallback: PeriodRange): PeriodRange {
  return value === 30 ? 30 : value === 7 ? 7 : fallback;
}

/** Repairs states written by older builds so a returning user keeps every record. */
export function normalizeState(parsed: AppState): AppState {
  parsed.categories.forEach((category) => {
    if (!category.status) category.status = "active";
    const legacyColor = LEGACY_DEFAULT_CATEGORY_COLORS[category.id as keyof typeof LEGACY_DEFAULT_CATEGORY_COLORS];
    if (legacyColor && String(category.color).toUpperCase() === legacyColor) {
      category.color = DEFAULT_CATEGORY_COLORS[category.id as keyof typeof DEFAULT_CATEGORY_COLORS];
    }
  });
  parsed.sessions ||= [];
  parsed.historyRange = normalizeRange(parsed.historyRange, 7);
  parsed.reflectionRange = normalizeRange(parsed.reflectionRange, 7);
  if (parsed.aiReflection && !parsed.aiReflection.factSnapshot) parsed.aiReflection = null;
  parsed.aiReflection ||= null;
  parsed.updatedAt ||= new Date().toISOString();
  return parsed;
}

export function placeCategoryInSlot(assignments: string[], slot: number, categoryId: string): string[] {
  if (!Array.isArray(assignments) || !Number.isInteger(slot) || slot < 0 || slot >= assignments.length) {
    throw new Error("Invalid Active 4 slot");
  }
  const next = [...assignments];
  const duplicateSlot = next.indexOf(categoryId);
  if (duplicateSlot !== -1 && duplicateSlot !== slot) {
    [next[slot], next[duplicateSlot]] = [next[duplicateSlot] as string, next[slot] as string];
  } else {
    next[slot] = categoryId;
  }
  return next;
}

export function applyActiveAssignments(state: AppState, assignments: string[]): AppState {
  if (!state || !Array.isArray(state.categories) || !Array.isArray(state.sessions)) throw new Error("Invalid Rhythm Hero state");
  if (!Array.isArray(assignments) || assignments.length !== state.assignments.length || new Set(assignments).size !== assignments.length) {
    throw new Error("Active 4 assignments must be unique");
  }
  const categoryIds = new Set(state.categories.map((category) => category.id));
  if (assignments.some((id) => !categoryIds.has(id))) throw new Error("Unknown Category assignment");
  const activeIds = new Set(assignments);
  return {
    ...state,
    assignments: [...assignments],
    categories: state.categories.map((category) =>
      activeIds.has(category.id) && category.status === "archived" ? { ...category, status: "active" } : category,
    ),
    sessions: state.sessions,
  };
}

export function completeActiveSession(
  state: AppState,
  endedAt: string = new Date().toISOString(),
): { state: AppState; completedSession: Session | null } {
  if (!state || !Array.isArray(state.sessions)) throw new Error("Invalid Rhythm Hero state");
  if (!state.activeSession) return { state, completedSession: null };
  const completedSession: Session = {
    ...state.activeSession,
    endedAt,
    status: "completed",
    memoCaptureState: "pending",
    memoCaptureCreatedAt: endedAt,
  };
  return {
    state: { ...state, sessions: [...state.sessions, completedSession], activeSession: null },
    completedSession,
  };
}

export function updateSessionMemo(
  state: AppState,
  sessionId: string,
  memo: string,
  captureState: MemoCaptureState,
  updatedAt: string = new Date().toISOString(),
): { state: AppState; updatedSession: Session | null } {
  if (!state || !Array.isArray(state.sessions)) throw new Error("Invalid Rhythm Hero state");
  if (!new Set(["saved", "skipped"]).has(captureState)) throw new Error("Invalid memo capture state");
  const normalizedMemo = String(memo || "").trim().slice(0, 160);
  if (captureState === "saved" && !normalizedMemo) throw new Error("A saved memo cannot be empty");
  let updatedSession: Session | null = null;
  const sessions = state.sessions.map((session) => {
    if (session.id !== sessionId || session.status !== "completed") return session;
    updatedSession = { ...session, memo: normalizedMemo, memoCaptureState: captureState, memoUpdatedAt: updatedAt, updatedAt };
    return updatedSession;
  });
  return { state: updatedSession ? { ...state, sessions } : state, updatedSession };
}

export function getPendingMemoSessionIds(state: AppState): string[] {
  if (!state || !Array.isArray(state.sessions)) return [];
  return state.sessions
    .filter((session) => session.status === "completed" && session.memoCaptureState === "pending")
    .sort((left, right) => new Date(left.endedAt || left.startedAt).getTime() - new Date(right.endedAt || right.startedAt).getTime())
    .map((session) => session.id);
}

export function isDuplicateCategoryName(state: AppState, name: string, editingId: string | null): boolean {
  const normalized = name.trim().toLocaleLowerCase("ko-KR");
  return state.categories.some(
    (category) => category.id !== editingId && category.name.trim().toLocaleLowerCase("ko-KR") === normalized,
  );
}
