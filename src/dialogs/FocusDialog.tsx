import { useEffect, useRef } from "react";

import { formatClock, formatMinutes, safeColor } from "../domain/format.ts";
import { countdown, goalStanding } from "../domain/goal.ts";
import { toyArt } from "../domain/profile.ts";
import type { ActiveSession, AppState, Category } from "../domain/types.ts";
import { durationMs } from "../domain/time.ts";
import { ActivityIcon } from "../components/ActivityIcon.tsx";

interface FocusDialogProps {
  state: AppState;
  session: ActiveSession | null;
  category: Category | undefined;
  open: boolean;
  tick: number;
  onStop: () => void;
  onMinimize: () => void;
}

/* The pressed button takes the whole screen: one activity, one clock, one way
   out. Minimising keeps the session running behind the now bar. */
export function FocusDialog({ state, session, category, open, tick, onStop, onMinimize }: FocusDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const visible = open && Boolean(session && category);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (visible && !dialog.open) dialog.showModal();
    if (!visible && dialog.open) dialog.close();
  }, [visible]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onMinimize();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onMinimize]);

  if (!session || !category) return <dialog className="focus-dialog" ref={ref} aria-labelledby="focus-title" />;

  const standing = goalStanding(state, category);
  const clock = countdown(state, category);
  const elapsed = durationMs(session);
  const reached = clock.hasGoal && clock.remainingMs === 0;
  void tick;

  return (
    <dialog className="focus-dialog" ref={ref} aria-labelledby="focus-title" style={{ ["--category" as string]: safeColor(category.color) }}>
      <div className="focus-shell">
        <header className="focus-top">
          <button className="icon-button focus-minimize" type="button" aria-label="접기" onClick={onMinimize}>⌄</button>
          <span className="focus-live"><span className="focus-live-dot" aria-hidden="true" />기록 중</span>
          <span />
        </header>

        <div className="focus-body">
          <img className="focus-toy" src={toyArt(state.profile?.toy ?? "spike", true)} alt="" draggable={false} />
          <div className="focus-activity">
            <ActivityIcon category={category} size="activity-icon-focus" />
            <h2 id="focus-title">{category.name}</h2>
          </div>
          {clock.hasGoal ? (
            <>
              <p className={`focus-clock${reached ? " reached" : ""}`} aria-live="off">
                {reached ? `+${formatClock(clock.overMs)}` : formatClock(clock.remainingMs)}
              </p>
              <p className="focus-standing">
                {reached
                  ? `${standing.periodLabel} 목표 ${formatMinutes(category.goal)} 채움 · 지금 ${formatClock(elapsed)}`
                  : `${standing.periodLabel} 목표 ${formatMinutes(category.goal)}에서 남은 시간 · 지금 ${formatClock(elapsed)}`}
              </p>
            </>
          ) : (
            <>
              <p className="focus-clock" aria-live="off">{formatClock(elapsed)}</p>
              <p className="focus-standing">{standing.periodLabel} {formatMinutes(standing.minutes)} · 목표 없이 기록</p>
            </>
          )}
          <div className="focus-ring" aria-hidden="true" style={{ ["--ratio" as string]: standing.ratio }} />
        </div>

        <footer className="focus-actions">
          <button className="button secondary" type="button" onClick={onMinimize}>접어두기</button>
          <button className="button focus-stop" type="button" onClick={onStop}>끝</button>
        </footer>
      </div>
    </dialog>
  );
}
