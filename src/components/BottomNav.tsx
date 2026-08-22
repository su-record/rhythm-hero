import { toyArt } from "../domain/profile.ts";
import type { Profile } from "../domain/types.ts";
import type { TabId } from "../types.ts";

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "today", label: "홈", icon: "nav-icon-today" },
  { id: "history", label: "흐름", icon: "nav-icon-history" },
  { id: "reflections", label: "돌아보기", icon: "nav-icon-reflection" },
  { id: "settings", label: "나", icon: "nav-icon-settings" },
];

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
      {TABS.map((item) => (
        <button
          key={item.id}
          className={`nav-item${item.id === tab ? " active" : ""}`}
          type="button"
          aria-current={item.id === tab ? "page" : "false"}
          aria-controls={`view-${item.id}`}
          onClick={() => onSelect(item.id)}
        >
          {item.id === "settings" && profile ? (
            <span className="nav-icon nav-icon-toy" aria-hidden="true"><img src={toyArt(profile.toy, false)} alt="" draggable={false} /></span>
          ) : (
            <span className={`nav-icon ${item.icon}`} aria-hidden="true" />
          )}
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
