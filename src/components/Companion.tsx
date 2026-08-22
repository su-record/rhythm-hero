import { toyArt } from "../domain/profile.ts";
import type { Category, Profile } from "../domain/types.ts";

export type CompanionMood = "waiting" | "running" | "talking";

interface CompanionProps {
  profile: Profile | null;
  mood: CompanionMood;
  runningCategory: Category | undefined;
  line: string | null;
  onDismiss: () => void;
  onPoke: () => void;
}

/* Blue is the active one, pink waits, in every family. Neither ever looks
   disappointed: the toy is bored, never judging. */
const LABEL: Record<CompanionMood, string> = { waiting: "기다리는 중", talking: "말하는 중", running: "기록 중" };

export function Companion({ profile, mood, runningCategory, line, onDismiss, onPoke }: CompanionProps) {
  const src = toyArt(profile?.toy ?? "spike", mood === "running");
  const toyName = profile?.toyName ?? "장난감";
  const caption = mood === "running" && runningCategory ? `${runningCategory.name} 기록 중` : `${toyName} · ${LABEL[mood]}`;

  return (
    <section className={`companion companion-${mood}`} aria-live="polite">
      {line ? (
        <div className="companion-bubble" role="status">
          <p>{line}</p>
          <button className="icon-button companion-bubble-close" type="button" aria-label="말풍선 닫기" onClick={onDismiss}>×</button>
        </div>
      ) : null}
      <button className="companion-figure" type="button" aria-label={`${caption}. 눌러서 말 걸기`} onClick={onPoke}>
        <img src={src} alt="" draggable={false} />
      </button>
      <p className="companion-caption">{caption}</p>
    </section>
  );
}
