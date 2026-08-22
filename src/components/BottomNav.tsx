import type { JSX } from "react";

import { toyArt } from "../domain/profile.ts";
import type { Profile } from "../domain/types.ts";
import type { TabId } from "../types.ts";

/* One consistent 24px stroke set. Active tabs swap to a filled variant so the
   state reads at a glance without a background pill behind it. */
const ICONS: Record<Exclude<TabId, "settings">, { outline: JSX.Element; filled: JSX.Element }> = {
  today: {
    outline: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
      </>
    ),
    filled: (
      <>
        <rect x="3" y="3" width="8" height="8" rx="2.2" fill="currentColor" stroke="none" />
        <rect x="13" y="3" width="8" height="8" rx="2.2" fill="currentColor" stroke="none" />
        <rect x="3" y="13" width="8" height="8" rx="2.2" fill="currentColor" stroke="none" />
        <rect x="13" y="13" width="8" height="8" rx="2.2" fill="currentColor" stroke="none" />
      </>
    ),
  },
  history: {
    outline: <path d="M3 16c3 0 3-8 6-8s3 8 6 8 3-8 6-8" />,
    filled: <path d="M3 16c3 0 3-8 6-8s3 8 6 8 3-8 6-8" strokeWidth="2.6" />,
  },
  reflections: {
    outline: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="m14.8 9.2-1.6 4-4 1.6 1.6-4z" />
      </>
    ),
    filled: (
      <>
        <circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" />
        <path d="m14.8 9.2-1.6 4-4 1.6 1.6-4z" fill="#fff" stroke="none" />
      </>
    ),
  },
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "today", label: "홈" },
  { id: "history", label: "흐름" },
  { id: "reflections", label: "돌아보기" },
  { id: "settings", label: "나" },
];

function TabIcon({ id, active, profile }: { id: TabId; active: boolean; profile: Profile | null }) {
  if (id === "settings") {
    return (
      <span className="nav-avatar" aria-hidden="true">
        {profile ? <img src={toyArt(profile.toy, false)} alt="" draggable={false} /> : <span className="nav-avatar-empty" />}
      </span>
    );
  }
  const icon = ICONS[id];
  return (
    <svg className="nav-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {active ? icon.filled : icon.outline}
    </svg>
  );
}

interface BottomNavProps {
  tab: TabId;
  runningCategoryName: string | null;
  profile: Profile | null;
  onSelect: (tab: TabId) => void;
}

export function BottomNav({ tab, runningCategoryName, profile, onSelect }: BottomNavProps) {
  return (
    <nav
      className={`bottom-nav${runningCategoryName ? " has-active-session" : ""}`}
      aria-label={runningCategoryName ? `주요 메뉴 · ${runningCategoryName} 기록 중` : "주요 메뉴"}
    >
      {TABS.map((item) => {
        const active = item.id === tab;
        return (
          <button
            key={item.id}
            className={`nav-item${active ? " active" : ""}`}
            type="button"
            aria-current={active ? "page" : "false"}
            aria-controls={`view-${item.id}`}
            onClick={() => onSelect(item.id)}
          >
            <TabIcon id={item.id} active={active} profile={profile} />
            <span className="nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
