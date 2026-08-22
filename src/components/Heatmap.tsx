import { formatDayNumber, formatMinutes, formatMonthDay, formatWeekdayNarrow, safeColor } from "../domain/format.ts";
import { minutesFor, sessionsForDay } from "../domain/stats.ts";
import { sameLocalDay } from "../domain/time.ts";
import type { AppState, Category, PeriodRange } from "../domain/types.ts";

function heatLevel(minutes: number, goal: number): string {
  if (minutes === 0) return "";
  const ratio = goal ? minutes / goal : minutes / 60;
  if (ratio < 0.3) return "l1";
  if (ratio < 0.65) return "l2";
  if (ratio < 1) return "l3";
  return "l4";
}

function cellLabel(category: Category, day: Date, minutes: number): string {
  return `${category.name} ${formatMonthDay(day)} ${minutes ? formatMinutes(minutes) : "기록 없음"}`;
}

interface HeatmapProps {
  state: AppState;
  days: Date[];
  range: PeriodRange;
}

export function Heatmap({ state, days, range }: HeatmapProps) {
  const minWidth = 64 + range * 32;
  const rowStyle = { ["--days" as string]: range, minWidth: `${minWidth}px` };

  return (
    <>
      <div className="week-labels">
        <div className="week-labels-row" style={rowStyle}>
          <span />
          {days.map((day) => (
            <span key={day.getTime()}>{range === 7 ? formatWeekdayNarrow(day) : formatDayNumber(day)}</span>
          ))}
        </div>
      </div>
      <div className="heatmap">
        {state.categories.map((category) => (
          <div className="heatmap-row" key={category.id} style={rowStyle}>
            <span className="heatmap-name" title={category.name}>{category.name}</span>
            {days.map((day) => {
              const minutes = minutesFor(category.id, sessionsForDay(state, day));
              const label = cellLabel(category, day, minutes);
              return (
                <span
                  key={day.getTime()}
                  className={`heat-cell ${heatLevel(minutes, category.goal)} ${sameLocalDay(day) ? "today" : ""}`.replace(/\s+/g, " ").trim()}
                  style={{ ["--category" as string]: safeColor(category.color) }}
                  title={label}
                  role="img"
                  aria-label={label}
                />
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
