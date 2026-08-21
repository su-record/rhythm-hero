export function placeCategoryInSlot(assignments, slot, categoryId) {
  if (!Array.isArray(assignments) || !Number.isInteger(slot) || slot < 0 || slot >= assignments.length) throw new Error("Invalid Active 4 slot");
  const next = [...assignments];
  const duplicateSlot = next.indexOf(categoryId);
  if (duplicateSlot !== -1 && duplicateSlot !== slot) [next[slot], next[duplicateSlot]] = [next[duplicateSlot], next[slot]];
  else next[slot] = categoryId;
  return next;
}

export function applyActiveAssignments(state, assignments) {
  if (!state || !Array.isArray(state.categories) || !Array.isArray(state.sessions)) throw new Error("Invalid Rhythm Hero state");
  if (!Array.isArray(assignments) || assignments.length !== state.assignments.length || new Set(assignments).size !== assignments.length) throw new Error("Active 4 assignments must be unique");
  const categoryIds = new Set(state.categories.map((category) => category.id));
  if (assignments.some((id) => !categoryIds.has(id))) throw new Error("Unknown Category assignment");
  const activeIds = new Set(assignments);
  return {
    ...state,
    assignments: [...assignments],
    categories: state.categories.map((category) => activeIds.has(category.id) && category.status === "archived" ? { ...category, status: "active" } : category),
    sessions: state.sessions,
  };
}

export function completeActiveSession(state, endedAt = new Date().toISOString()) {
  if (!state || !Array.isArray(state.sessions)) throw new Error("Invalid Rhythm Hero state");
  if (!state.activeSession) return { state, completedSession: null };
  const completedSession = {
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

export function updateSessionMemo(state, sessionId, memo, captureState, updatedAt = new Date().toISOString()) {
  if (!state || !Array.isArray(state.sessions)) throw new Error("Invalid Rhythm Hero state");
  if (!new Set(["saved", "skipped"]).has(captureState)) throw new Error("Invalid memo capture state");
  const normalizedMemo = String(memo || "").trim().slice(0, 160);
  if (captureState === "saved" && !normalizedMemo) throw new Error("A saved memo cannot be empty");
  let updatedSession = null;
  const sessions = state.sessions.map((session) => {
    if (session.id !== sessionId || session.status !== "completed") return session;
    updatedSession = {
      ...session,
      memo: normalizedMemo,
      memoCaptureState: captureState,
      memoUpdatedAt: updatedAt,
      updatedAt,
    };
    return updatedSession;
  });
  return { state: updatedSession ? { ...state, sessions } : state, updatedSession };
}

export function getPendingMemoSessionIds(state) {
  if (!state || !Array.isArray(state.sessions)) return [];
  return state.sessions
    .filter((session) => session.status === "completed" && session.memoCaptureState === "pending")
    .sort((left, right) => new Date(left.endedAt || left.startedAt) - new Date(right.endedAt || right.startedAt))
    .map((session) => session.id);
}
