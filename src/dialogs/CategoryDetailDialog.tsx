import { useEffect, useState } from "react";

import { formatMinutes, formatMonthDay, formatStartTime, safeColor } from "../domain/format.ts";
import { categoryById, categoryStats, minutesFor, sessionsForDay } from "../domain/stats.ts";
import { durationMs, recentDays } from "../domain/time.ts";
import type { AppState, Category } from "../domain/types.ts";
import { useDialog } from "../hooks/useDialog.ts";

const DETAIL_HEATMAP_DAYS = 28;
const DETAIL_SESSION_LIMIT = 5;

function heatLevel(minutes: number, goal: number): string {
  if (minutes === 0) return "";
  const ratio = goal ? minutes / goal : minutes / 60;
  if (ratio < 0.3) return "l1";
  if (ratio < 0.65) return "l2";
  if (ratio < 1) return "l3";
  return "l4";
}

function longDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value));
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(value));
}

interface CategoryDetailDialogProps {
  state: AppState;
  category: Category | null;
  onClose: () => void;
  onEdit: (id: string) => void;
  onAddToActive4: (slot: number) => void;
}

export function CategoryDetailDialog({ state, category, onClose, onEdit, onAddToActive4 }: CategoryDetailDialogProps) {
  const [slot, setSlot] = useState(0);
  const ref = useDialog(Boolean(category), onClose);

  useEffect(() => {
    if (category) setSlot(0);
  }, [category]);

  if (!category) return <dialog ref={ref} aria-labelledby="category-detail-title" />;

  const stats = categoryStats(state, category.id);
  const assignedSlot = state.assignments.indexOf(category.id);
  const previous = categoryById(state, state.assignments[slot] ?? "");

  return (
    <dialog ref={ref} aria-labelledby="category-detail-title">
      <form method="dialog">
        <div className="dialog-header category-detail-header">
          <div>
            <p className="eyebrow">
              {assignedSlot !== -1
                ? `${assignedSlot + 1}번 버튼 · 나의 네 가지에서 사용 중`
                : category.status === "archived" ? "보관 중인 활동" : "전체 활동 기록"}
            </p>
            <div className="category-detail-title-row">
              <span style={{ backgroundColor: safeColor(category.color) }} aria-hidden="true" />
              <h2 id="category-detail-title">{category.name}</h2>
            </div>
          </div>
          <div className="category-detail-header-actions">
            <button className="button quiet category-edit-button" type="button" onClick={() => onEdit(category.id)}>이름 편집</button>
            <button className="icon-button" value="cancel" type="submit" aria-label="닫기">×</button>
          </div>
        </div>
        <p className="dialog-copy">
          {stats.lastSession ? `마지막 기록 ${longDate(stats.lastSession.startedAt)}` : "첫 번째 시간을 기록하면 이곳에 쌓이기 시작합니다."}
        </p>
        <div className="category-detail-metrics">
          <div><span>전체 누적</span><strong>{formatMinutes(stats.totalMinutes)}</strong></div>
          <div><span>활동한 날</span><strong>{`${stats.activeDays}일`}</strong></div>
          <div><span>기록 수</span><strong>{`${stats.sessions.length}개`}</strong></div>
        </div>

        <section className="detail-activity">
          <div className="detail-section-title"><strong>최근 4주</strong><span>시간이 많을수록 진하게 표시돼요</span></div>
          <div className="detail-heatmap">
            {recentDays(DETAIL_HEATMAP_DAYS).map((day) => {
              const minutes = minutesFor(category.id, sessionsForDay(state, day));
              const label = `${category.name} ${formatMonthDay(day)} ${minutes ? formatMinutes(minutes) : "기록 없음"}`;
              return (
                <span
                  key={day.getTime()}
                  className={`detail-heat-cell ${heatLevel(minutes, category.goal)}`.trim()}
                  style={{ ["--category" as string]: safeColor(category.color) }}
                  title={label}
                  role="img"
                  aria-label={label}
                />
              );
            })}
          </div>
        </section>

        <section className="detail-sessions-section">
          <div className="detail-section-title"><strong>최근 기록</strong></div>
          <div className="detail-session-list">
            {stats.sessions.length ? stats.sessions.slice(0, DETAIL_SESSION_LIMIT).map((session) => (
              <div className="detail-session-row" key={session.id}>
                <span>
                  <strong>{shortDate(session.startedAt)}</strong>
                  <small>{`${formatStartTime(session.startedAt)} 시작${session.memo ? ` · ${session.memo}` : ""}`}</small>
                </span>
                <b>{formatMinutes(durationMs(session) / 60_000)}</b>
              </div>
            )) : <p className="detail-empty">아직 완료된 기록이 없어요.</p>}
          </div>
        </section>

        <section className={`detail-active4-controls${assignedSlot === -1 ? "" : " hidden"}`}>
          <label>
            교체할 버튼
            <select value={slot} aria-label="교체할 나의 네 가지 버튼" onChange={(event) => setSlot(Number(event.target.value))}>
              {state.assignments.map((assignedId, index) => (
                <option value={index} key={index}>{`Button ${index + 1} · ${categoryById(state, assignedId)?.name ?? ""}`}</option>
              ))}
            </select>
          </label>
          <p>
            {previous
              ? `Button ${slot + 1}의 ${previous.name}을 ${category.name}으로 교체합니다. ${previous.name}의 기존 기록은 그대로 유지됩니다.`
              : ""}
          </p>
          <button className="button full" type="button" onClick={() => onAddToActive4(slot)}>나의 네 가지에 추가</button>
        </section>
      </form>
    </dialog>
  );
}
