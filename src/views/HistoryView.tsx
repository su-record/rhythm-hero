import { useEffect, useMemo, useRef, useState } from "react";

import { formatMinutes } from "../domain/format.ts";
import { minutesFor, recentSessions, sessionsForDay } from "../domain/stats.ts";
import { recentDays } from "../domain/time.ts";
import type { AppState, PeriodRange, Session } from "../domain/types.ts";
import { CategoryLibrary } from "../components/CategoryLibrary.tsx";
import { Heatmap } from "../components/Heatmap.tsx";
import { SessionList } from "../components/SessionList.tsx";

const RECENT_SESSION_LIMIT = 8;
const SHOW_MEMOS_KEY = "rhythm-hero-show-memos";

function readShowMemos(): boolean {
  try {
    return localStorage.getItem(SHOW_MEMOS_KEY) === "1";
  } catch {
    return false;
  }
}

interface HistoryViewProps {
  state: AppState;
  active: boolean;
  pendingMemoCount: number;
  onSelectRange: (range: PeriodRange) => void;
  onOpenSession: (id: string) => void;
  onOpenCategory: (id: string) => void;
  onReviewMemos: () => void;
}

interface HistorySummary {
  days: Date[];
  total: number;
  activeDays: number;
  summary: string;
  recent: Session[];
}

function summarise(state: AppState): HistorySummary {
  const days = recentDays(state.historyRange);
  const periodSessions = days.flatMap((day) => sessionsForDay(state, day));
  const ranked = state.categories
    .map((category) => ({ category, minutes: minutesFor(category.id, periodSessions) }))
    .sort((left, right) => right.minutes - left.minutes);
  const most = ranked[0];
  return {
    days,
    total: ranked.reduce((sum, item) => sum + item.minutes, 0),
    activeDays: days.filter((day) => sessionsForDay(state, day).length > 0).length,
    summary: most?.minutes ? `${most.category.name}에 가장 많은 시간을 썼어요.` : "아직 기록이 없어요.",
    recent: recentSessions(state, RECENT_SESSION_LIMIT),
  };
}

export function HistoryView({ state, active, pendingMemoCount, ...handlers }: HistoryViewProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const { days, total, activeDays, summary, recent } = useMemo(() => summarise(state), [state]);
  const [showMemos, setShowMemos] = useState(readShowMemos);
  const memoCount = recent.filter((session) => session.memo).length;

  useEffect(() => {
    try {
      localStorage.setItem(SHOW_MEMOS_KEY, showMemos ? "1" : "0");
    } catch {
      /* Private mode: the choice just does not survive a reload. */
    }
  }, [showMemos]);

  // A 30 day map is scrolled to today; a 7 day map fits and stays at the start.
  useEffect(() => {
    const element = scroller.current;
    if (!element || !active) return;
    const align = () => {
      element.scrollLeft = state.historyRange === 30 ? Math.max(0, element.scrollWidth - element.clientWidth) : 0;
    };
    align();
    const frame = requestAnimationFrame(align);
    return () => cancelAnimationFrame(frame);
  }, [active, state.historyRange]);

  return (
    <section className={`view${active ? " active" : ""}`} id="view-history" aria-labelledby="history-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{`최근 ${state.historyRange}일`}</p>
          <h1 id="history-title">흐름</h1>
        </div>
        <div className="segmented" role="group" aria-label="기록 기간">
          {([7, 30] as PeriodRange[]).map((range) => (
            <button
              key={range}
              className={state.historyRange === range ? "selected" : undefined}
              type="button"
              aria-pressed={state.historyRange === range}
              aria-controls="heatmap"
              onClick={() => handlers.onSelectRange(range)}
            >
              {range}일
            </button>
          ))}
        </div>
      </div>

      <section className="history-metrics" aria-label="기간 요약">
        <div className="metric-cell">
          <span>{state.historyRange === 7 ? "최근 7일 누적" : "최근 30일 누적"}</span>
          <strong>{formatMinutes(total)}</strong>
        </div>
        <div className="metric-cell"><span>활동한 날</span><strong>{`${activeDays}일`}</strong></div>
        <div className="metric-cell metric-flow"><span>가장 많이 기록한 활동</span><p>{summary}</p></div>
      </section>

      <section className="history-card">
        <div className="card-heading"><h2>활동 지도</h2><span>기록한 날을 한눈에 볼 수 있어요</span></div>
        <div className="activity-map-scroll" ref={scroller} data-range={state.historyRange} tabIndex={0} aria-label="기간별 활동 지도">
          <Heatmap state={state} days={days} range={state.historyRange} />
        </div>
      </section>

      <CategoryLibrary state={state} onOpen={handlers.onOpenCategory} />

      <section className="section-heading compact">
        <div><h2>최근 기록</h2></div>
        <div className="section-tools">
          <button
            className={`text-button${pendingMemoCount ? "" : " hidden"}`}
            type="button"
            onClick={handlers.onReviewMemos}
          >
            메모 대기 <span>{pendingMemoCount}</span>
          </button>
          <button
            className={`text-button memo-toggle${showMemos ? " on" : ""}`}
            type="button"
            aria-pressed={showMemos}
            disabled={!memoCount}
            title={memoCount ? undefined : "메모가 있는 기록이 없어요"}
            onClick={() => setShowMemos((value) => !value)}
          >
            {showMemos ? "한 줄 메모 숨기기" : "한 줄 메모 보기"}
          </button>
        </div>
      </section>
      <SessionList state={state} sessions={recent} showMemos={showMemos} onOpen={handlers.onOpenSession} />
    </section>
  );
}
