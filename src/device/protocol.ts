import { safeColor } from "../domain/format.ts";
import { categoryById, todayMinutes } from "../domain/stats.ts";
import type { AppState } from "../domain/types.ts";

export const SERIAL_BAUD_RATE = 115200;

export interface LedButton {
  index: number;
  color: string;
  progress: number;
  running: boolean;
}

export interface LedPayload {
  type: "led";
  buttons: LedButton[];
}

const DEFAULT_GOAL_MINUTES = 60;

/** Pure so every accepted and rejected board line can be covered by a test. */
export function parseHardwareLine(line: string): number | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const shorthand = trimmed.match(/^BUTTON\s*:\s*([1-4])$/i);
  if (shorthand?.[1]) return Number(shorthand[1]);
  try {
    const event = JSON.parse(trimmed) as { type?: string; index?: unknown };
    const index = Number(event?.index);
    if (event?.type === "button" && Number.isInteger(index) && index >= 1 && index <= 4) return index;
  } catch {
    return null;
  }
  return null;
}

export function buildLedPayload(state: AppState): LedPayload {
  return {
    type: "led",
    buttons: state.assignments.map((id, index) => {
      const category = categoryById(state, id);
      const goal = category?.goal || DEFAULT_GOAL_MINUTES;
      return {
        index: index + 1,
        color: safeColor(category?.color),
        progress: Math.min(1, todayMinutes(state, id) / goal),
        running: state.activeSession?.categoryId === id,
      };
    }),
  };
}
