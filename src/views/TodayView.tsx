import { useMemo } from "react";

import { buildDayCards, deriveRoutine, describeRoutine } from "../domain/routine.ts";
import { categoryById, todayMinutes } from "../domain/stats.ts";
import type { AppState, Session } from "../domain/types.ts";
import { CategoryCard } from "../components/CategoryCard.tsx";
import { Companion, type CompanionMood } from "../components/Companion.tsx";
import { MemoInbox } from "../components/MemoInbox.tsx";
import { MiniInsight } from "../components/MiniInsight.tsx";
import { RoutineDeck } from "../components/RoutineDeck.tsx";

interface TodayViewProps {
  state: AppState;
  active: boolean;
  tick: number;
  insight: string;
  pendingMemos: Session[];
  companionLine: string | null;
  onDismissCompanion: () => void;
  onPokeCompanion: () => void;
  onPressButton: (index: number) => void;
  onManualStart: () => void;
  onWriteMemo: () => void;
  onOpenReflections: () => void;
  onEditActive4: () => void;
}

const DECK_DAYS = 7;

export function TodayView({ state, active, tick, insight, pendingMemos, companionLine, ...handlers }: TodayViewProps) {
  const activeCategory = state.activeSession ? categoryById(state, state.activeSession.categoryId) : undefined;
  const isRunning = Boolean(activeCategory);
  const mood: CompanionMood = isRunning ? "running" : companionLine ? "talking" : "waiting";

  // The tick only re-runs the arithmetic; the cards themselves are never rebuilt.
  const { cards, dayCards } = useMemo(() => ({
    cards: state.assignments.map((id) => ({ category: categoryById(state, id), minutes: todayMinutes(state, id) })),
    dayCards: buildDayCards(state, DECK_DAYS),
  }), [state, tick]);
  const routineLabel = useMemo(() => describeRoutine(deriveRoutine(state, DECK_DAYS)), [state]);

  return (
    <section className={`view${active ? " active" : ""}`} id="view-today" aria-labelledby="today-title">
      <Companion
        mood={mood}
        runningCategory={activeCategory}
        line={companionLine}
        onDismiss={handlers.onDismissCompanion}
        onPoke={handlers.onPokeCompanion}
      />
      <RoutineDeck cards={dayCards} routineLabel={routineLabel} />

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
