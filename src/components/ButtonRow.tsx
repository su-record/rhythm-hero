import { formatMinutes, safeColor } from "../domain/format.ts";
import { goalStanding } from "../domain/goal.ts";
import type { AppState, Category } from "../domain/types.ts";
import { ActivityIcon } from "./ActivityIcon.tsx";

interface ButtonRowProps {
  state: AppState;
  buttons: Array<Category | undefined>;
  runningId: string | null;
  onPress: (index: number) => void;
}

/* Four buttons in a row, the way they sit on the board. A daily activity shows
   today, a weekly one shows the week: each button reports in its own period. */
export function ButtonRow({ state, buttons, runningId, onPress }: ButtonRowProps) {
  return (
    <div className="button-row" role="group" aria-label="나의 네 가지 버튼">
      {buttons.map((category, index) => {
        if (!category) return null;
        const running = runningId === category.id;
        const standing = goalStanding(state, category);
        return (
          <button
            key={category.id}
            className={`category-card compact${running ? " running" : ""}${standing.complete ? " goal-complete" : ""}`}
            style={{ ["--category" as string]: safeColor(category.color) }}
            type="button"
            aria-pressed={running}
            aria-label={`${category.name}, ${standing.periodLabel} ${formatMinutes(standing.minutes)}, ${running ? "기록 종료" : "기록 시작"}`}
            onClick={() => onPress(index + 1)}
          >
            <span className="button-index">{index + 1}</span>
            <ActivityIcon category={category} size="activity-icon-button" />
            <strong className="category-name">{category.name}</strong>
            <span className="category-time">{standing.minutes > 0 ? formatMinutes(standing.minutes) : "–"}</span>
            <span className="category-period">{standing.periodLabel}</span>
            <span className="progress-track"><span className="progress-fill" style={{ width: `${standing.ratio * 100}%` }} /></span>
          </button>
        );
      })}
    </div>
  );
}
