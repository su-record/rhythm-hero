import { formatMinutes, safeColor } from "../domain/format.ts";
import type { Category } from "../domain/types.ts";
import { ActivityIcon } from "./ActivityIcon.tsx";

interface CategoryCardProps {
  category: Category;
  index: number;
  minutes: number;
  running: boolean;
  onPress: (index: number) => void;
}

export function CategoryCard({ category, index, minutes, running, onPress }: CategoryCardProps) {
  const percentage = category.goal ? Math.min((minutes / category.goal) * 100, 100) : Math.min(minutes, 100);
  const goalComplete = Boolean(category.goal && minutes >= category.goal);
  const color = safeColor(category.color);
  const duration = formatMinutes(minutes);

  return (
    <button
      className={`category-card${running ? " running" : ""}${goalComplete ? " goal-complete" : ""}`}
      style={{ ["--category" as string]: color, ["--category-soft" as string]: `${color}14` }}
      type="button"
      aria-pressed={running}
      aria-label={`${category.name}, 오늘 ${duration}, ${running ? "기록 종료" : "기록 시작"}`}
      onClick={() => onPress(index + 1)}
    >
      <span className="card-top">
        <ActivityIcon category={category} size="activity-icon-card" />
        <span className="button-index">{index + 1}</span>
      </span>
      <span className="category-content">
        <strong className="category-name">{category.name}</strong>
        <span className="category-time">{duration}</span>
      </span>
      <span className="progress-track">
        <span className="progress-fill" style={{ width: `${percentage}%` }} />
      </span>
      <span className="category-card-footer">
        <span className="category-goal">{category.goal ? `오늘 목표 ${category.goal}분` : "목표 없이 기록"}</span>
        <span className="card-status">{running ? "기록 중" : goalComplete ? "완료 ✓" : "눌러서 시작"}</span>
      </span>
    </button>
  );
}
