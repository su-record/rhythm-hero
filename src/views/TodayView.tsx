import { useMemo } from "react";

import { buildDayCards, deriveRoutine, describeRoutine } from "../domain/routine.ts";
import { describeWeek, weeklyProgress } from "../domain/week.ts";
import { categoryById } from "../domain/stats.ts";
import type { AppState, Session } from "../domain/types.ts";
import { ButtonRow } from "../components/ButtonRow.tsx";
import { MemoInbox } from "../components/MemoInbox.tsx";
import { WeekGoals } from "../components/WeekGoals.tsx";
import { RoutineDeck } from "../components/RoutineDeck.tsx";

interface TodayViewProps {
  state: AppState;
  active: boolean;
  tick: number;
  pendingMemos: Session[];
  companionLine: string | null;
  onDismissCompanion: () => void;
  onPokeCompanion: () => void;
  onPressButton: (index: number) => void;
  onManualStart: () => void;
  onWriteMemo: () => void;
  onEditActive4: () => void;
  onEditGoals: () => void;
}

const DECK_DAYS = 7;

export function TodayView({ state, active, tick, pendingMemos, companionLine, ...handlers }: TodayViewProps) {
  const activeCategory = state.activeSession ? categoryById(state, state.activeSession.categoryId) : undefined;
  const isRunning = Boolean(activeCategory);
  const mood = isRunning ? "running" : companionLine ? "talking" : "waiting";

  // The tick only re-runs the arithmetic; the cards themselves are never rebuilt.
  const { buttons, dayCards, week } = useMemo(() => ({
    buttons: state.assignments.map((id) => categoryById(state, id)),
    dayCards: buildDayCards(state, DECK_DAYS),
    week: weeklyProgress(state),
  }), [state, tick]);
  const routineLabel = useMemo(() => describeRoutine(deriveRoutine(state, DECK_DAYS)), [state]);

  return (
    <section className={`view${active ? " active" : ""}`} id="view-today" aria-labelledby="today-title">
      <RoutineDeck
        cards={dayCards}
        routineLabel={routineLabel}
        ownerName={state.profile?.name ?? null}
        companion={{
          profile: state.profile,
          mood,
          line: companionLine,
          onDismiss: handlers.onDismissCompanion,
          onPoke: handlers.onPokeCompanion,
        }}
      />

      <section className="section-heading compact">
        <div>
          <h2>버튼</h2>
          <p>보드와 같은 순서예요</p>
        </div>
        <div className="section-tools">
          <span className="keyboard-hint keyboard-only-hint" role="note" aria-label="데스크톱 키보드 단축키 1부터 4까지">키보드 1–4</span>
          <button className="edit-link" type="button" onClick={handlers.onEditActive4}>편집</button>
        </div>
      </section>
      <ButtonRow state={state} buttons={buttons} runningId={state.activeSession?.categoryId ?? null} onPress={handlers.onPressButton} />

      <WeekGoals progress={week} summary={describeWeek(week)} onEditGoals={handlers.onEditGoals} />

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
    </section>
  );
}
