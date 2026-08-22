import { useEffect, useRef, useState } from "react";

import { MAX_PROFILE_NAME, TOY_COPY, TOY_FAMILIES, createProfile, toyArt } from "../domain/profile.ts";
import type { Profile, ToyFamily } from "../domain/types.ts";

interface ProfileDialogProps {
  open: boolean;
  /** Existing profile when editing; null on first run, where the dialog cannot be dismissed. */
  current: Profile | null;
  onSave: (profile: Profile) => void;
  onClose: () => void;
}

export function ProfileDialog({ open, current, onSave, onClose }: ProfileDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [toy, setToy] = useState<ToyFamily>("spike");
  const [toyName, setToyName] = useState("");
  const [error, setError] = useState("");
  const firstRun = current === null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setName(current?.name ?? "");
    setToy(current?.toy ?? "spike");
    setToyName(current?.toyName ?? "");
    setError("");
    const frame = requestAnimationFrame(() => nameInput.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, current]);

  // First run has no way out: the records need an owner before anything is written.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      if (firstRun) event.preventDefault();
    };
    const handleClose = () => {
      if (!firstRun) onClose();
    };
    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("close", handleClose);
    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("close", handleClose);
    };
  }, [firstRun, onClose]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const profile = createProfile(name, toy, toyName);
    if (!profile) {
      setError("이름을 알려주세요. 기록의 주인이 필요해요.");
      nameInput.current?.focus();
      return;
    }
    onSave(current ? { ...profile, createdAt: current.createdAt } : profile);
  };

  return (
    <dialog className="profile-dialog" ref={ref} aria-labelledby="profile-dialog-title">
      <form method="dialog" onSubmit={submit}>
        <div className="dialog-header">
          <div>
            <p className="eyebrow">{firstRun ? "처음 만나요" : "나"}</p>
            <h2 id="profile-dialog-title">{firstRun ? "같이 지낼 장난감을 골라요" : "장난감과 이름 바꾸기"}</h2>
          </div>
          {firstRun ? null : <button className="icon-button" value="cancel" type="submit" formNoValidate aria-label="닫기">×</button>}
        </div>
        <p className="dialog-copy">이 기기의 기록은 전부 당신 것이 돼요. 로그인은 없어요. 장난감이 당신을 기억해요.</p>

        <div className="toy-picker" role="radiogroup" aria-label="장난감 선택">
          {TOY_FAMILIES.map((family) => (
            <label key={family} className={`toy-option${toy === family ? " selected" : ""}`}>
              <input type="radio" name="toy" value={family} checked={toy === family} onChange={() => setToy(family)} />
              <span className="toy-option-art" aria-hidden="true">
                <img src={toyArt(family, false)} alt="" draggable={false} />
                <img src={toyArt(family, true)} alt="" draggable={false} className="toy-option-active" />
              </span>
              <strong>{TOY_COPY[family].label}</strong>
              <span>{TOY_COPY[family].blurb}</span>
            </label>
          ))}
        </div>

        <label>
          내 이름
          <input
            ref={nameInput}
            type="text"
            maxLength={MAX_PROFILE_NAME}
            placeholder="예: 수"
            autoComplete="nickname"
            value={name}
            aria-invalid={Boolean(error)}
            aria-describedby="profile-name-error"
            onChange={(event) => {
              setError("");
              setName(event.target.value);
            }}
          />
        </label>
        <p className="field-error" id="profile-name-error" role="alert" aria-live="polite" hidden={!error}>{error}</p>
        <label>
          장난감 이름 <span>선택</span>
          <input
            type="text"
            maxLength={MAX_PROFILE_NAME}
            placeholder={TOY_COPY[toy].label}
            value={toyName}
            onChange={(event) => setToyName(event.target.value)}
          />
        </label>
        <button className="button full" type="submit" value="default">{firstRun ? "시작하기" : "저장"}</button>
      </form>
    </dialog>
  );
}
