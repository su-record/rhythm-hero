import { useEffect, useState } from "react";

import { selectableCategories } from "../domain/stats.ts";
import type { AppState } from "../domain/types.ts";
import { useDialog } from "../hooks/useDialog.ts";

interface RecordDialogProps {
  state: AppState;
  open: boolean;
  onClose: () => void;
  onStart: (categoryId: string) => void;
}

export function RecordDialog({ state, open, onClose, onStart }: RecordDialogProps) {
  const options = selectableCategories(state);
  const [categoryId, setCategoryId] = useState(options[0]?.id ?? "");
  const ref = useDialog(open, onClose);

  useEffect(() => {
    if (open && !options.some((option) => option.id === categoryId)) setCategoryId(options[0]?.id ?? "");
  }, [open, options, categoryId]);

  return (
    <dialog ref={ref} aria-labelledby="record-dialog-title">
      <form
        method="dialog"
        onSubmit={(event) => {
          if ((event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") !== "default") return;
          event.preventDefault();
          onStart(categoryId);
        }}
      >
        <div className="dialog-header">
          <div><p className="eyebrow">직접 기록</p><h2 id="record-dialog-title">어떤 시간을 기록할까요?</h2></div>
          <button className="icon-button" value="cancel" type="submit" aria-label="닫기">×</button>
        </div>
        <label>
          활동
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            {options.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}
          </select>
        </label>
        <p className="dialog-copy">활동을 고르고 지금부터 시간을 기록하세요.</p>
        <button className="button full" value="default" type="submit">지금 기록 시작</button>
      </form>
    </dialog>
  );
}
