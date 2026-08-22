import type { TabId } from "../types.ts";

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "today", label: "오늘", icon: "nav-icon-today" },
  { id: "history", label: "기록", icon: "nav-icon-history" },
  { id: "reflections", label: "돌아보기", icon: "nav-icon-reflection" },
  { id: "settings", label: "설정", icon: "nav-icon-settings" },
];

interface BottomNavProps {
  tab: TabId;
  runningCategoryName: string | null;
  onSelect: (tab: TabId) => void;
}

export function BottomNav({ tab, runningCategoryName, onSelect }: BottomNavProps) {
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
          <span className={`nav-icon ${item.icon}`} aria-hidden="true" />
          {item.label}
        </button>
      ))}
    </nav>
  );
}
