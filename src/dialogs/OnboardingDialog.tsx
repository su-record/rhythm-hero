import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { formatMinutes } from "../domain/format.ts";
import { GOAL_TYPE_LABEL } from "../domain/goal.ts";
import {
  ACTIVITY_PALETTE,
  GOAL_PRESETS,
  MAX_ACTIVITIES,
  MAX_ACTIVITY_NAME,
  SUGGESTED_ACTIVITIES,
  addActivity,
  removeActivity,
  setActivityGoal,
  type ActivityDraft,
} from "../domain/onboarding.ts";
import { MAX_PROFILE_NAME, TOY_COPY, TOY_FAMILIES, createProfile, toyArt } from "../domain/profile.ts";
import type { GoalType, Profile, ToyFamily } from "../domain/types.ts";

type Step = "intro" | "activities" | "time" | "profile";
const STEPS: Step[] = ["intro", "activities", "time", "profile"];

interface OnboardingDialogProps {
  open: boolean;
  onComplete: (profile: Profile, activities: ActivityDraft[]) => void;
}

function IntroStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="onboarding-step onboarding-intro">
      <div className="onboarding-toys" aria-hidden="true">
        <img src={toyArt("spike", false)} alt="" draggable={false} />
        <img src={toyArt("bouncer", true)} alt="" draggable={false} />
      </div>
      <h2 id="onboarding-title">버튼 4개, 네 가지 시간.</h2>
      <ul className="onboarding-points">
        <li><strong>누르면 기록</strong><span>보드의 버튼 하나가 활동 하나예요. 다시 누르면 끝.</span></li>
        <li><strong>하루가 카드로</strong><span>옆으로 넘기면 지난 날이 보여요. 리듬은 기록에서 저절로 나와요.</span></li>
        <li><strong>조용하면 말을 걸어요</strong><span>장난감이 먼저 "심심해"라고 해요. 잔소리는 안 해요.</span></li>
      </ul>
      <button className="button full" type="button" onClick={onNext}>시작할게요</button>
    </div>
  );
}

type DraftSetter = Dispatch<SetStateAction<ActivityDraft[]>>;

/* Updates go through the setter's functional form so rapid taps never race a stale closure. */
function ActivitiesStep({ drafts, onChange, onNext }: { drafts: ActivityDraft[]; onChange: DraftSetter; onNext: () => void }) {
  const [custom, setCustom] = useState("");
  const full = drafts.length >= MAX_ACTIVITIES;
  const picked = new Set(drafts.map((draft) => draft.name));
  const addCustom = () => {
    onChange((previous) => addActivity(previous, custom));
    setCustom("");
  };

  return (
    <div className="onboarding-step">
      <p className="eyebrow">{drafts.length}/{MAX_ACTIVITIES}</p>
      <h2 id="onboarding-title">지금 당신의 삶에서<br />중요한 것은 무엇인가요?</h2>
      <p className="dialog-copy">최대 네 가지. 보드의 버튼 네 개가 돼요.</p>

      <div className="activity-chips" role="group" aria-label="활동 고르기">
        {SUGGESTED_ACTIVITIES.map((name) => {
          const selected = picked.has(name);
          return (
            <button
              key={name}
              type="button"
              className={`activity-chip${selected ? " selected" : ""}`}
              aria-pressed={selected}
              disabled={!selected && full}
              onClick={() => onChange((previous) => (selected ? removeActivity(previous, name) : addActivity(previous, name)))}
            >
              {name}
            </button>
          );
        })}
      </div>

      <form
        className="activity-custom"
        onSubmit={(event) => {
          event.preventDefault();
          addCustom();
        }}
      >
        <input
          type="text"
          maxLength={MAX_ACTIVITY_NAME}
          placeholder="직접 적기 (예: 피아노)"
          value={custom}
          disabled={full}
          onChange={(event) => setCustom(event.target.value)}
        />
        <button className="button secondary" type="submit" disabled={full || !custom.trim()}>추가</button>
      </form>

      {drafts.length ? (
        <ol className="activity-picked" aria-label="고른 활동">
          {drafts.map((draft, index) => (
            <li key={draft.name} style={{ ["--category" as string]: ACTIVITY_PALETTE[index] }}>
              <span className="activity-picked-index">{index + 1}</span>
              <span>{draft.name}</span>
              <button className="icon-button" type="button" aria-label={`${draft.name} 빼기`} onClick={() => onChange((previous) => removeActivity(previous, draft.name))}>×</button>
            </li>
          ))}
        </ol>
      ) : null}

      <button className="button full" type="button" disabled={!drafts.length} onClick={onNext}>
        {drafts.length ? "이 시간들로 할게요" : "하나는 골라주세요"}
      </button>
    </div>
  );
}

function TimeStep({ drafts, onChange, onNext }: { drafts: ActivityDraft[]; onChange: DraftSetter; onNext: () => void }) {
  return (
    <div className="onboarding-step">
      <h2 id="onboarding-title">얼마나 시간을 낼까요?</h2>
      <p className="dialog-copy">하루 단위든 한 주 단위든 괜찮아요. 나중에 바꿀 수 있어요.</p>
      <ul className="time-plan">
        {drafts.map((draft, index) => (
          <li key={draft.name} style={{ ["--category" as string]: ACTIVITY_PALETTE[index] }}>
            <div className="time-plan-head">
              <span className="activity-picked-index">{index + 1}</span>
              <strong>{draft.name}</strong>
              <span className="segmented" role="group" aria-label={`${draft.name} 단위`}>
                {(["daily", "weekly"] as GoalType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={draft.goalType === type ? "selected" : undefined}
                    aria-pressed={draft.goalType === type}
                    onClick={() => onChange((previous) => setActivityGoal(previous, draft.name, type, GOAL_PRESETS[type][1] ?? 30))}
                  >
                    {GOAL_TYPE_LABEL[type]}
                  </button>
                ))}
              </span>
            </div>
            <div className="time-presets" role="group" aria-label={`${draft.name} 목표 시간`}>
              {GOAL_PRESETS[draft.goalType].map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className={`time-preset${draft.goal === minutes ? " selected" : ""}`}
                  aria-pressed={draft.goal === minutes}
                  onClick={() => onChange((previous) => setActivityGoal(previous, draft.name, draft.goalType, minutes))}
                >
                  {formatMinutes(minutes)}
                </button>
              ))}
              <label className="time-custom">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={draft.goalType === "weekly" ? 5040 : 720}
                  value={draft.goal}
                  aria-label={`${draft.name} 직접 입력(분)`}
                  onChange={(event) => { const value = Number(event.target.value); onChange((previous) => setActivityGoal(previous, draft.name, draft.goalType, value)); }}
                />
                <span>분</span>
              </label>
            </div>
          </li>
        ))}
      </ul>
      <button className="button full" type="button" onClick={onNext}>좋아요</button>
    </div>
  );
}

function ProfileStep({ onFinish }: { onFinish: (profile: Profile) => void }) {
  const [name, setName] = useState("");
  const [toy, setToy] = useState<ToyFamily>("spike");
  const [toyName, setToyName] = useState("");
  const [error, setError] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => nameInput.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <form
      className="onboarding-step"
      onSubmit={(event) => {
        event.preventDefault();
        const profile = createProfile(name, toy, toyName);
        if (!profile) {
          setError("이름을 알려주세요. 기록의 주인이 필요해요.");
          nameInput.current?.focus();
          return;
        }
        onFinish(profile);
      }}
    >
      <h2 id="onboarding-title">같이 지낼 장난감을 골라요</h2>
      <p className="dialog-copy">로그인은 없어요. 이 기기의 기록은 전부 당신 거예요.</p>
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
          aria-describedby="onboarding-name-error"
          onChange={(event) => {
            setError("");
            setName(event.target.value);
          }}
        />
      </label>
      <p className="field-error" id="onboarding-name-error" role="alert" aria-live="polite" hidden={!error}>{error}</p>
      <label>
        장난감 이름 <span>선택</span>
        <input type="text" maxLength={MAX_PROFILE_NAME} placeholder={TOY_COPY[toy].label} value={toyName} onChange={(event) => setToyName(event.target.value)} />
      </label>
      <button className="button full" type="submit">시작하기</button>
    </form>
  );
}

/* First run, and only first run. It cannot be dismissed: a record needs an
   owner and at least one activity before anything is written. */
export function OnboardingDialog({ open, onComplete }: OnboardingDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<Step>("intro");
  const [drafts, setDrafts] = useState<ActivityDraft[]>([]);
  const stepIndex = STEPS.indexOf(step);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const block = (event: Event) => event.preventDefault();
    dialog.addEventListener("cancel", block);
    return () => dialog.removeEventListener("cancel", block);
  }, []);

  useEffect(() => {
    ref.current?.querySelector(".onboarding-body")?.scrollTo({ top: 0 });
  }, [step]);

  const next = () => setStep(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)] ?? step);
  const back = () => setStep(STEPS[Math.max(stepIndex - 1, 0)] ?? step);

  return (
    <dialog className="onboarding-dialog" ref={ref} aria-labelledby="onboarding-title">
      <div className="onboarding-top">
        {stepIndex > 0 ? <button className="icon-button" type="button" aria-label="이전" onClick={back}>‹</button> : <span />}
        <div className="onboarding-progress" aria-label={`${stepIndex + 1}단계 / ${STEPS.length}단계`}>
          {STEPS.map((item, index) => <span key={item} className={index <= stepIndex ? "done" : undefined} />)}
        </div>
        <span />
      </div>
      <div className="onboarding-body">
        {step === "intro" ? <IntroStep onNext={next} /> : null}
        {step === "activities" ? <ActivitiesStep drafts={drafts} onChange={setDrafts} onNext={next} /> : null}
        {step === "time" ? <TimeStep drafts={drafts} onChange={setDrafts} onNext={next} /> : null}
        {step === "profile" ? <ProfileStep onFinish={(profile) => onComplete(profile, drafts)} /> : null}
      </div>
    </dialog>
  );
}
