import { formatMinutes, safeColor } from "../domain/format.ts";
import { categoryStats } from "../domain/stats.ts";
import type { AppState, Category } from "../domain/types.ts";
import { ActivityIcon } from "./ActivityIcon.tsx";

function shortDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(value));
}

/** Active 4 first in slot order, then live Categories, then archived ones. */
function orderCategories(state: AppState): Category[] {
  return [...state.categories].sort((left, right) => {
    const leftSlot = state.assignments.indexOf(left.id);
    const rightSlot = state.assignments.indexOf(right.id);
    if (leftSlot !== -1 || rightSlot !== -1) return (leftSlot === -1 ? 99 : leftSlot) - (rightSlot === -1 ? 99 : rightSlot);
    if (left.status !== right.status) return left.status === "archived" ? 1 : -1;
    return categoryStats(state, right.id).totalMinutes - categoryStats(state, left.id).totalMinutes;
  });
}

export function CategoryLibrary({ state, onOpen }: { state: AppState; onOpen: (id: string) => void }) {
  return (
    <>
      <section className="section-heading compact category-library-heading">
        <div>
          <h2>모든 활동</h2>
          <p>{`${state.categories.length}개의 활동 · 나의 네 가지에서 내려도 기록은 유지됩니다.`}</p>
        </div>
      </section>
      <div className="category-library">
        {orderCategories(state).map((category) => {
          const stats = categoryStats(state, category.id);
          const slot = state.assignments.indexOf(category.id);
          const status = slot !== -1
            ? `${slot + 1}번 버튼 · 나의 네 가지`
            : category.status === "archived"
              ? "보관 중"
              : stats.lastSession
                ? `마지막 기록 ${shortDate(stats.lastSession.startedAt)}`
                : "아직 기록 없음";
          return (
            <button
              key={category.id}
              className="category-library-item"
              style={{ ["--category" as string]: safeColor(category.color) }}
              type="button"
              onClick={() => onOpen(category.id)}
            >
              <ActivityIcon category={category} size="activity-icon-list" />
              <span className="category-library-info">
                <strong>{category.name}</strong>
                <span>{status}</span>
              </span>
              <span className="category-library-total">{formatMinutes(stats.totalMinutes)}</span>
              <span className="category-library-arrow" aria-hidden="true">›</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
