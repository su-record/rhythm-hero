import { forwardRef } from "react";

import { formatClock } from "../domain/format.ts";
import { durationMs } from "../domain/time.ts";
import type { ActiveSession, Category } from "../domain/types.ts";
import { ActivityIcon } from "./ActivityIcon.tsx";

interface NowCardProps {
  session: ActiveSession | null;
  category: Category | undefined;
  onStop: () => void;
  onOpen: () => void;
}

export const NowCard = forwardRef<HTMLElement, NowCardProps>(function NowCard({ session, category, onStop, onOpen }, ref) {
  const running = Boolean(session && category);
  return (
    <section
      ref={ref}
      className={`now-card global-session-bar${running ? "" : " hidden"}`}
      data-session-state={running ? "running" : "idle"}
      aria-labelledby="now-state-label now-category"
      tabIndex={-1}
    >
      <div className="now-pulse" aria-hidden="true" />
      <button className="now-open" type="button" aria-label="전체 화면으로 보기" onClick={onOpen}>
        <span className="now-icon" aria-hidden="true">
          {category ? <ActivityIcon category={category} size="activity-icon-now" /> : null}
        </span>
        <span className="now-copy">
          <span className="eyebrow" id="now-state-label">지금 기록 중</span>
          <strong id="now-category">{category?.name ?? ""}</strong>
        </span>
        <span className="now-duration">{session ? formatClock(durationMs(session)) : "00:00:00"}</span>
      </button>
      <button className="button dark" type="button" aria-label={category ? `${category.name} 기록 종료` : "기록 종료"} onClick={onStop}>
        종료
      </button>
    </section>
  );
});
