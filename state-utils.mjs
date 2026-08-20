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
