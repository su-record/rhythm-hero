import { useEffect, useState } from "react";

import { placeCategoryInSlot } from "../domain/state.ts";
import { categoryById } from "../domain/stats.ts";
import { safeColor } from "../domain/format.ts";
import type { AppState } from "../domain/types.ts";
import { ActivityIcon } from "../components/ActivityIcon.tsx";
import { useDialog } from "../hooks/useDialog.ts";

interface Active4DialogProps {
  state: AppState;
  open: boolean;
  onClose: () => void;
  onSave: (assignments: string[]) => void;
}

export function Active4Dialog({ state, open, onClose, onSave }: Active4DialogProps) {
  const [draft, setDraft] = useState<string[]>(state.assignments);
  const ref = useDialog(open, onClose);

  useEffect(() => {
    if (open) setDraft([...state.assignments]);
  }, [open, state.assignments]);

  return (
    <dialog ref={ref} aria-labelledby="active4-dialog-title">
      <form
        method="dialog"
        onSubmit={(event) => {
          if ((event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") !== "default") return;
          event.preventDefault();
          onSave(draft);
        }}
      >
        <div className="dialog-header">
          <div><p className="eyebrow">버튼 배치</p><h2 id="active4-dialog-title">나의 네 가지 편집</h2></div>
          <button className="icon-button" value="cancel" type="submit" aria-label="닫기">×</button>
        </div>
        <p className="dialog-copy">각 버튼에 연결할 활동을 선택하세요. 교체해도 이전 시간은 그대로 보관됩니다.</p>
        <div className="active4-editor">
          {draft.map((id, index) => {
            const category = categoryById(state, id);
            return (
              <label className="active4-editor-row" key={index} style={{ ["--category" as string]: safeColor(category?.color) }}>
                <span className="active4-slot">{index + 1}</span>
                <ActivityIcon category={category} size="activity-icon-list" />
                <span className="active4-row-copy">
                  <strong>{`${index + 1}번 버튼`}</strong>
                  <span>{`현재 ${category?.name ?? ""}`}</span>
                </span>
                <select
                  value={id}
                  aria-label={`${index + 1}번 버튼 활동`}
                  onChange={(event) => setDraft((current) => placeCategoryInSlot(current, index, event.target.value))}
                >
                  {state.categories.map((option) => (
                    <option value={option.id} key={option.id}>
                      {option.status === "archived" ? `${option.name} · 보관 중` : option.name}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
        <div className="preserve-note">
          <span aria-hidden="true">✓</span>
          <p><strong>기록은 사라지지 않아요.</strong><br />나의 네 가지는 버튼 연결만 변경합니다.</p>
        </div>
        <button className="button full" value="default" type="submit">변경사항 저장</button>
      </form>
    </dialog>
  );
}
