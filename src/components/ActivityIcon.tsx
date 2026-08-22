import type { JSX } from "react";

import { safeColor } from "../domain/format.ts";
import type { Category } from "../domain/types.ts";

type IconKey = "move" | "read" | "music" | "project" | "generic";

const ARTWORK: Record<IconKey, JSX.Element> = {
  move: (
    <>
      <path className="activity-icon-fill" d="M11.5 30.2c4.8-.2 7.6-1.9 9.7-5.8l2.3-4.2 4.5 5.3c2.7 3.2 5.8 4.7 9.7 5.4l2.8.5v5.2H12.7c-2.2 0-3.7-1.5-3.7-3.4 0-1.6.9-2.8 2.5-3Z" />
      <path d="M12 30.1c4.4-.3 7.2-2 9.2-5.7l2.3-4.2 4.5 5.3c2.7 3.2 5.8 4.7 9.7 5.4l2.8.5v5.2H12.7c-2.2 0-3.7-1.5-3.7-3.4 0-1.6 1.1-2.9 3-3.1Z" />
      <path d="M20.4 26.1l4 2.3m-6.5.1 3.9 2.2M12 36.6h28.5" />
    </>
  ),
  read: (
    <>
      <path className="activity-icon-fill" d="M7.8 12.6c6.6-.9 11.8.4 16.2 4.1 4.4-3.7 9.6-5 16.2-4.1v24.1c-6.6-.9-11.8.4-16.2 4.1-4.4-3.7-9.6-5-16.2-4.1V12.6Z" />
      <path d="M7.8 12.6c6.6-.9 11.8.4 16.2 4.1 4.4-3.7 9.6-5 16.2-4.1v24.1c-6.6-.9-11.8.4-16.2 4.1-4.4-3.7-9.6-5-16.2-4.1V12.6Z" />
      <path d="M24 16.7v24.1M12.2 18.8c3.2-.1 5.9.6 8.2 2.1m-8.2 4c3.2-.1 5.9.6 8.2 2.1m15.4-8.2c-3.2-.1-5.9.6-8.2 2.1m8.2 4c-3.2-.1-5.9.6-8.2 2.1" />
    </>
  ),
  music: (
    <>
      <path className="activity-icon-fill" d="M21 13.8 38.5 10v21.1a6.3 6.3 0 1 1-3.7-5.7V16.8L24.7 19v16.1a6.3 6.3 0 1 1-3.7-5.7V13.8Z" />
      <path d="M21 13.8 38.5 10v21.1a6.3 6.3 0 1 1-3.7-5.7V16.8L24.7 19v16.1a6.3 6.3 0 1 1-3.7-5.7V13.8Z" />
      <path d="M24.7 19 38.5 16" />
    </>
  ),
  project: (
    <>
      <path className="activity-icon-fill" d="M13 10.8h22v29H13z" />
      <path d="M13 10.8h22v29H13z" />
      <path d="M20 9h8v5.2h-8zM18 22l2.2 2.2 4.2-4.4M18 31l2.2 2.2 4.2-4.4M27.5 22h3.7m-3.7 9h3.7" />
      <path className="activity-icon-paper" d="m33.5 35.5 6.4-6.4 2 2-6.4 6.4-3 .9z" />
    </>
  ),
  generic: (
    <>
      <rect className="activity-icon-fill" x="9" y="9" width="12" height="12" rx="3" />
      <rect x="27" y="9" width="12" height="12" rx="3" />
      <rect x="9" y="27" width="12" height="12" rx="3" />
      <path d="m33 26 6 6-6 6-6-6 6-6Z" />
    </>
  ),
};

const NAMED_ICONS = new Set<string>(["move", "read", "music", "project"]);

interface ActivityIconProps {
  category: Category | undefined;
  size?: string;
}

export function ActivityIcon({ category, size = "" }: ActivityIconProps) {
  const key: IconKey = category && NAMED_ICONS.has(category.id) ? (category.id as IconKey) : "generic";
  return (
    <svg
      className={`activity-icon ${size}`.trim()}
      style={{ ["--icon-color" as string]: safeColor(category?.color) }}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="#111111" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {ARTWORK[key]}
      </g>
    </svg>
  );
}
