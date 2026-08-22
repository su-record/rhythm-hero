import { useEffect, useState } from "react";

import { durationMs, localDateInput, localTimeInput } from "../domain/time.ts";
import type { AppState, Session } from "../domain/types.ts";
import type { SessionEdit } from "../store/actions.ts";
import { useDialog } from "../hooks/useDialog.ts";

interface SessionDialogProps {
  state: AppState;
  session: Session | null;
  onClose: () => void;
  onSave: (id: string, edit: SessionEdit) => void;
  onDelete: (id: string) => void;
  onInvalid: () => void;
}

interface Draft {
  categoryId: string;
  date: string;
  time: string;
  duration: string;
  memo: string;
}

function draftFor(session: Session): Draft {
  return {
    categoryId: session.categoryId,
    date: localDateInput(session.startedAt),
    time: localTimeInput(session.startedAt),
    duration: String(Math.max(1, Math.round(durationMs(session) / 60_000))),
    memo: session.memo || "",
  };
}

const EMPTY_DRAFT: Draft = { categoryId: "", date: "", time: "", duration: "", memo: "" };

export function SessionDialog({ state, session, onClose, onSave, onDelete, onInvalid }: SessionDialogProps) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const ref = useDialog(Boolean(session), onClose);

  useEffect(() => {
    if (session) setDraft(draftFor(session));
  }, [session]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("data-action");
    if (!action || !session) return;
    event.preventDefault();
    if (action === "delete") return onDelete(session.id);

    const started = new Date(`${draft.date}T${draft.time}:00`);
    const minutes = Number(draft.duration);
    if (Number.isNaN(started.getTime()) || !Number.isFinite(minutes) || minutes < 1) return onInvalid();
    onSave(session.id, { categoryId: draft.categoryId, startedAt: started.toISOString(), minutes, memo: draft.memo });
  };

  return (
    <dialog ref={ref} aria-labelledby="session-dialog-title">
      <form method="dialog" onSubmit={submit}>
        <div className="dialog-header">
          <div><p className="eyebrow">기록 수정</p><h2 id="session-dialog-title">남긴 시간을 다듬어요</h2></div>
          <button className="icon-button" value="cancel" type="submit" aria-label="닫기">×</button>
        </div>
        <label>
          활동
          <select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}>
            {state.categories.map((category) => (
              <option value={category.id} key={category.id}>
                {category.status === "archived" ? `${category.name} (보관됨)` : category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          날짜
          <input type="date" required value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
        </label>
        <div className="inline-fields">
          <label>
            시작 시간
            <input type="time" required value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} />
          </label>
          <label>
            지속 시간(분)
            <input
              type="number"
              min={1}
              max={720}
              required
              value={draft.duration}
              onChange={(event) => setDraft({ ...draft, duration: event.target.value })}
            />
          </label>
        </div>
        <label>
          한 줄 메모 <span>선택</span>
          <input type="text" maxLength={160} value={draft.memo} onChange={(event) => setDraft({ ...draft, memo: event.target.value })} />
        </label>
        <div className="dialog-actions">
          <button className="button secondary danger" data-action="delete" value="default" type="submit">삭제</button>
          <button className="button" data-action="save" value="default" type="submit">저장</button>
        </div>
      </form>
    </dialog>
  );
}
