import { formatMinutes, formatStartTime, safeColor } from "../domain/format.ts";
import { categoryById } from "../domain/stats.ts";
import { durationMs } from "../domain/time.ts";
import type { AppState, Session } from "../domain/types.ts";
import { ActivityIcon } from "./ActivityIcon.tsx";

interface SessionListProps {
  state: AppState;
  sessions: Session[];
  /** Show each record's one-line memo inline, without opening it. */
  showMemos?: boolean;
  onOpen: (id: string) => void;
}

export function SessionList({ state, sessions, showMemos = false, onOpen }: SessionListProps) {
  if (!sessions.length) return <div className="session-list"><p className="page-intro">아직 완료된 기록이 없어요.</p></div>;

  return (
    <div className="session-list">
      {sessions.map((session) => {
        const category = categoryById(state, session.categoryId);
        const pending = session.memoCaptureState === "pending";
        const memoLabel = session.memo ? " · 메모 있음" : pending ? " · 한 줄 기다림" : "";
        return (
          <button
            key={session.id}
            className={`session-item${pending ? " memo-pending" : ""}`}
            style={{ ["--category" as string]: safeColor(category?.color) }}
            type="button"
            onClick={() => onOpen(session.id)}
          >
            <ActivityIcon category={category} size="activity-icon-list" />
            <span className="session-info">
              <strong>{category?.name ?? ""}</strong>
              <span>{`${formatStartTime(session.startedAt)} 시작 · ${session.source === "device" ? "버튼 기록" : "앱 기록"}${memoLabel}`}</span>
            </span>
            {pending ? <span className="session-note-badge">메모 대기</span> : null}
            <span className="session-duration">{formatMinutes(durationMs(session) / 60_000)}</span>
            {showMemos && session.memo ? <span className="session-memo">{session.memo}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
