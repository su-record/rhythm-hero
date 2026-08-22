import { formatMinutes, safeColor } from "../domain/format.ts";
import type { GoalProgress } from "../domain/goal.ts";

interface GoalBoardProps {
  progress: GoalProgress[];
  summary: string;
  onAddGoal: () => void;
}

/* Every goal in its own period: a daily one reports today, a weekly one the
   week. One way in: "+ 목표 추가"; the unit is chosen inside the dialog. */
export function GoalBoard({ progress, summary, onAddGoal }: GoalBoardProps) {
  return (
    <section className="week-goals" aria-labelledby="week-goals-title">
      <div className="section-heading compact">
        <div>
          <h2 id="week-goals-title">목표</h2>
          <p>{summary}</p>
        </div>
        {progress.length ? <button className="edit-link" type="button" onClick={onAddGoal}>+ 목표 추가</button> : null}
      </div>
      {progress.length ? (
        <ul className="week-goal-list">
          {progress.map((item) => (
            <li
              key={item.category.id}
              className={`week-goal${item.complete ? " done" : ""}`}
              style={{ ["--category" as string]: safeColor(item.category.color) }}
            >
              <span className="week-goal-ring" aria-hidden="true" style={{ ["--ratio" as string]: item.ratio }}>
                <span className="week-goal-ring-dot" />
              </span>
              <span className="week-goal-copy">
                <strong>{item.category.name} <em className="week-goal-period">{item.periodLabel}</em></strong>
                <span>
                  {formatMinutes(item.minutes)} / {formatMinutes(item.goal)}
                  {item.complete ? " · 채움 ✓" : item.periodLabel === "이번 주" ? ` · 하루 ${formatMinutes(Math.ceil(item.perDayLeft))}씩` : ` · ${formatMinutes(Math.ceil(item.perDayLeft))} 남음`}
                </span>
              </span>
              <span className="week-goal-percent">{Math.round(item.ratio * 100)}%</span>
            </li>
          ))}
        </ul>
      ) : (
        <button className="week-goal-empty" type="button" onClick={onAddGoal}>+ 목표 추가</button>
      )}
    </section>
  );
}
