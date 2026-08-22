import { forwardRef } from "react";

import { formatClock } from "../domain/format.ts";
import { durationMs } from "../domain/time.ts";
import type { ActiveSession, Category } from "../domain/types.ts";
import { ActivityIcon } from "./ActivityIcon.tsx";

interface NowCardProps {
  session: ActiveSession | null;
  category: Category | undefined;
  onStop: () => void;
}

export const NowCard = forwardRef<HTMLElement, NowCardProps>(function NowCard({ session, category, onStop }, ref) {
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
      <span className="now-icon" aria-hidden="true">
        {category ? <ActivityIcon category={category} size="activity-icon-now" /> : null}
      </span>
      <div className="now-copy">
        <p className="eyebrow" id="now-state-label">지금 기록 중</p>
        <strong id="now-category">{category?.name ?? ""}</strong>
      </div>
      <p className="now-duration">{session ? formatClock(durationMs(session)) : "00:00:00"}</p>
      <button className="button dark" type="button" aria-label={category ? `${category.name} 기록 종료` : "기록 종료"} onClick={onStop}>
        종료
      </button>
    </section>
  );
});
