import { useMemo } from "react";

import { formatMinutes } from "../domain/format.ts";
import { categoryById, todayMinutes, totalTodayMinutes } from "../domain/stats.ts";
import type { AppState, Session } from "../domain/types.ts";
import { CategoryCard } from "../components/CategoryCard.tsx";
import { MemoInbox } from "../components/MemoInbox.tsx";
import { MiniInsight } from "../components/MiniInsight.tsx";

interface TodayViewProps {
  state: AppState;
  active: boolean;
  tick: number;
  insight: string;
  pendingMemos: Session[];
  onPressButton: (index: number) => void;
  onManualStart: () => void;
  onWriteMemo: () => void;
  onOpenReflections: () => void;
  onEditActive4: () => void;
}

function todayLabel(): string {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
}

export function TodayView({ state, active, tick, insight, pendingMemos, ...handlers }: TodayViewProps) {
  const activeCategory = state.activeSession ? categoryById(state, state.activeSession.categoryId) : undefined;
  const isRunning = Boolean(activeCategory);

  // The tick only re-runs the arithmetic; the cards themselves are never rebuilt.
  const { total, cards } = useMemo(() => ({
    total: totalTodayMinutes(state),
    cards: state.assignments.map((id) => ({ category: categoryById(state, id), minutes: todayMinutes(state, id) })),
  }), [state, tick]);

  const recordedCount = state.categories.filter((category) => todayMinutes(state, category.id) > 0).length;

  return (
    <section className={`view${active ? " active" : ""}`} id="view-today" aria-labelledby="today-title">
      <section className="today-overview" data-state={isRunning ? "running" : "idle"}>
        <div className="overview-heading">
          <div>
            <p className="eyebrow">{todayLabel()}</p>
            <h1 id="today-title">오늘 쌓인 시간</h1>
          </div>
        </div>
        <div className="total-block">
          <p className="total-label">지금까지</p>
          <p className="total-time">{formatMinutes(total)}</p>
          <p className="hero-message">
            <span className="pastel-dot" aria-hidden="true" />
            <span>
              {activeCategory
                ? `${activeCategory.name} 기록 중`
                : recordedCount
                  ? `오늘 ${recordedCount}개 활동을 기록했어요.`
                  : "아직 기록이 없어요. 네 가지 중 하나를 눌러 시작하세요."}
            </span>
          </p>
        </div>
      </section>

      <section className="section-heading">
        <div>
          <h2>나의 네 가지</h2>
          <p>눌러서 바로 기록해요</p>
        </div>
        <div className="section-tools">
          <span className="keyboard-hint keyboard-only-hint" role="note" aria-label="데스크톱 키보드 단축키 1부터 4까지">키보드 1–4</span>
          <button className="edit-link" type="button" onClick={handlers.onEditActive4}>편집</button>
        </div>
      </section>
      <div className="category-grid">
        {cards.map(({ category, minutes }, index) =>
          category ? (
            <CategoryCard
              key={category.id}
              category={category}
              index={index}
              minutes={minutes}
              running={state.activeSession?.categoryId === category.id}
              onPress={handlers.onPressButton}
            />
          ) : null,
        )}
      </div>

      <button
        className="manual-button"
        type="button"
        aria-label={activeCategory ? `${activeCategory.name} 현재 기록 보기` : "앱에서 기록 시작"}
        onClick={handlers.onManualStart}
      >
        <span aria-hidden="true">{isRunning ? "●" : "＋"}</span>
        <span>{isRunning ? "현재 기록 보기" : "앱에서 기록 시작"}</span>
      </button>

      <MemoInbox state={state} pending={pendingMemos} onWrite={handlers.onWriteMemo} />
      <MiniInsight message={insight} onOpenReflections={handlers.onOpenReflections} />
    </section>
  );
}
