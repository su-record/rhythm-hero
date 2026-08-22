import { formatMinutes } from "../domain/format.ts";
import { durationMs } from "../domain/time.ts";
import type { AppState, Session } from "../domain/types.ts";
import { categoryById } from "../domain/stats.ts";

interface MemoInboxProps {
  state: AppState;
  pending: Session[];
  onWrite: () => void;
}

export function MemoInbox({ state, pending, onWrite }: MemoInboxProps) {
  const latest = pending[pending.length - 1];
  const category = latest ? categoryById(state, latest.categoryId) : undefined;
  const name = category?.name ?? "기록";
  const single = pending.length === 1;

  return (
    <section className={`memo-inbox${pending.length ? "" : " hidden"}`} aria-labelledby="memo-inbox-title">
      <div className="memo-inbox-icon" aria-hidden="true">✎</div>
      <div className="memo-inbox-copy">
        <p className="eyebrow">한 줄을 기다리는 기록</p>
        <strong id="memo-inbox-title">
          {single ? "방금 끝낸 시간을 한 줄로 남겨보세요." : `메모를 기다리는 기록이 ${pending.length}개 있어요.`}
        </strong>
        <p>
          {!latest ? "" : single
            ? `${name} · ${formatMinutes(durationMs(latest) / 60_000)}`
            : `가장 최근 기록은 ${name} ${formatMinutes(durationMs(latest) / 60_000)}이에요.`}
        </p>
      </div>
      <button className="button secondary" type="button" onClick={onWrite}>메모 남기기</button>
    </section>
  );
}
