import { formatMinutes, safeColor } from "../domain/format.ts";
import type { WeeklyProgress } from "../domain/week.ts";

interface WeekGoalsProps {
  progress: WeeklyProgress[];
  summary: string;
  onEditGoals: () => void;
}

export function WeekGoals({ progress, summary, onEditGoals }: WeekGoalsProps) {
  return (
    <section className="week-goals" aria-labelledby="week-goals-title">
      <div className="section-heading compact">
        <div>
          <h2 id="week-goals-title">이번 주</h2>
          <p>{summary}</p>
        </div>
        <button className="edit-link" type="button" onClick={onEditGoals}>+ 목표 추가</button>
      </div>
      {progress.length ? (
        <ul className="week-goal-list">
          {progress.map((item) => (
            <li
              key={item.category.id}
              className={`week-goal${item.done ? " done" : ""}`}
              style={{ ["--category" as string]: safeColor(item.category.color) }}
            >
              <span className="week-goal-ring" aria-hidden="true" style={{ ["--ratio" as string]: item.ratio }}>
                <span className="week-goal-ring-dot" />
              </span>
              <span className="week-goal-copy">
                <strong>{item.category.name}</strong>
                <span>
                  {formatMinutes(item.minutes)} / {formatMinutes(item.goal)}
                  {item.done ? " · 채움 ✓" : ` · 하루 ${formatMinutes(Math.ceil(item.perDayLeft))}씩`}
                </span>
              </span>
              <span className="week-goal-percent">{Math.round(item.ratio * 100)}%</span>
            </li>
          ))}
        </ul>
      ) : (
        <button className="week-goal-empty" type="button" onClick={onEditGoals}>+ 한 주 목표 추가</button>
      )}
    </section>
  );
}
