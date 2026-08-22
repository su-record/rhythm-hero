import { formatMinutes, safeColor } from "../domain/format.ts";
import type { Category } from "../domain/types.ts";
import { ActivityIcon } from "./ActivityIcon.tsx";

interface ButtonRowProps {
  buttons: Array<{ category: Category | undefined; minutes: number }>;
  runningId: string | null;
  onPress: (index: number) => void;
}

/* Four buttons in a row, the way they sit on the board. The screen mirrors the toy. */
export function ButtonRow({ buttons, runningId, onPress }: ButtonRowProps) {
  return (
    <div className="button-row" role="group" aria-label="나의 네 가지 버튼">
      {buttons.map(({ category, minutes }, index) => {
        if (!category) return null;
        const running = runningId === category.id;
        const goalComplete = Boolean(category.goal && minutes >= category.goal);
        const percentage = category.goal ? Math.min((minutes / category.goal) * 100, 100) : Math.min(minutes, 100);
        return (
          <button
            key={category.id}
            className={`category-card compact${running ? " running" : ""}${goalComplete ? " goal-complete" : ""}`}
            style={{ ["--category" as string]: safeColor(category.color) }}
            type="button"
            aria-pressed={running}
            aria-label={`${category.name}, 오늘 ${formatMinutes(minutes)}, ${running ? "기록 종료" : "기록 시작"}`}
            onClick={() => onPress(index + 1)}
          >
            <span className="button-index">{index + 1}</span>
            <ActivityIcon category={category} size="activity-icon-button" />
            <strong className="category-name">{category.name}</strong>
            <span className="category-time">{minutes > 0 ? formatMinutes(minutes) : "–"}</span>
            <span className="progress-track"><span className="progress-fill" style={{ width: `${percentage}%` }} /></span>
          </button>
        );
      })}
    </div>
  );
}
