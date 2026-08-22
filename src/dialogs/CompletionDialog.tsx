import { useEffect, useRef, useState } from "react";

import { formatMinutes } from "../domain/format.ts";
import { categoryById } from "../domain/stats.ts";
import { durationMs } from "../domain/time.ts";
import type { AppState, Session } from "../domain/types.ts";
import { useDialog } from "../hooks/useDialog.ts";

interface CompletionDialogProps {
  state: AppState;
  session: Session | null;
  onClose: () => void;
  onSettle: (memo: string, captureState: "saved" | "skipped") => void;
  onLater: () => void;
}

const EMPTY_MEMO_MESSAGE = "한 줄 메모를 입력하거나 ‘메모 없이 완료’를 선택해주세요.";

function summarise(session: Session): string {
  const clock = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  const range = `${clock.format(new Date(session.startedAt))}–${clock.format(new Date(session.endedAt ?? session.startedAt))}`;
  return `${formatMinutes(durationMs(session) / 60_000)} · ${range}`;
}

export function CompletionDialog({ state, session, onClose, onSettle, onLater }: CompletionDialogProps) {
  const [memo, setMemo] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const ref = useDialog(Boolean(session), onClose);
  const category = session ? categoryById(state, session.categoryId) : undefined;

  useEffect(() => {
    if (!session) return;
    setMemo(session.memo || "");
    // A pointer user lands in the field; a touch user keeps the keyboard closed.
    const frame = requestAnimationFrame(() => {
      if (matchMedia("(min-width: 640px) and (pointer: fine)").matches) input.current?.focus();
      else heading.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [session]);

  const save = () => {
    if (!memo.trim()) {
      input.current?.setCustomValidity(EMPTY_MEMO_MESSAGE);
      input.current?.reportValidity();
      input.current?.focus();
      return;
    }
    onSettle(memo.trim(), "saved");
  };

  return (
    <dialog className="completion-dialog" ref={ref} aria-labelledby="completion-dialog-title" aria-describedby="completion-summary completion-memo-hint">
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div className="completion-celebration" aria-hidden="true"><span>✓</span></div>
        <div className="completion-heading">
          <p className="eyebrow">{`${category?.name ?? "기록"} 완료`}</p>
          <h2 id="completion-dialog-title" ref={heading} tabIndex={-1}>방금 한 일을 한 줄로 남길까요?</h2>
          <p id="completion-summary">{session ? summarise(session) : ""}</p>
        </div>
        <label className="completion-memo-label" htmlFor="completion-memo">오늘 한 줄 <span>선택</span></label>
        <input
          id="completion-memo"
          ref={input}
          type="text"
          maxLength={160}
          autoComplete="off"
          enterKeyHint="done"
          placeholder="예: 3장까지 읽었고 집중이 잘 됐어요"
          value={memo}
          onChange={(event) => {
            input.current?.setCustomValidity("");
            setMemo(event.target.value);
          }}
        />
        <p className="dialog-copy" id="completion-memo-hint">시간 기록은 이미 안전하게 저장됐어요.</p>
        <div className="completion-actions">
          <button className="button quiet" type="button" onClick={onLater}>나중에</button>
          <button className="button secondary" type="button" onClick={() => onSettle("", "skipped")}>메모 없이 완료</button>
          <button className="button" type="submit" value="default" disabled={!memo.trim()}>메모 저장</button>
        </div>
      </form>
    </dialog>
  );
}
