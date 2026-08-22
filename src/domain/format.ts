import type { PeriodBounds } from "./types.ts";

export const DEFAULT_CATEGORY_COLORS = Object.freeze({
  move: "#FF5D52",
  read: "#20D68A",
  music: "#5B70FF",
  project: "#FFD43B",
});

export const LEGACY_DEFAULT_CATEGORY_COLORS = Object.freeze({
  move: "#E7A08E",
  read: "#8EB5E8",
  music: "#B49ACC",
  project: "#79BFAF",
});

export function safeColor(value: unknown): string {
  return /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : DEFAULT_CATEGORY_COLORS.music;
}

export function formatMinutes(minutes: number): string {
  const rounded = Math.max(0, Math.floor(minutes));
  if (rounded < 1) return "1분 미만";
  if (rounded < 60) return `${rounded}분`;
  return `${Math.floor(rounded / 60)}시간${rounded % 60 ? ` ${rounded % 60}분` : ""}`;
}

export function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function formatReflectionMinutes(minutes: number): string {
  return minutes > 0 ? formatMinutes(minutes) : "0분";
}

export function formatReflectionPeriod(bounds: PeriodBounds): string {
  const inclusiveEnd = new Date(bounds.end);
  inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
  const formatter = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric" });
  return `${formatter.format(bounds.start)}–${formatter.format(inclusiveEnd)}`;
}

export function formatWeekdayNarrow(day: Date): string {
  return new Intl.DateTimeFormat("ko-KR", { weekday: "narrow" }).format(day);
}

export function formatDayNumber(day: Date): string {
  return new Intl.DateTimeFormat("ko-KR", { day: "numeric" }).format(day);
}

export function formatMonthDay(day: Date): string {
  return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(day);
}

export function formatStartTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}
