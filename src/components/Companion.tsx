import type { Category } from "../domain/types.ts";

export type CompanionMood = "waiting" | "running" | "talking";

interface CompanionProps {
  mood: CompanionMood;
  runningCategory: Category | undefined;
  line: string | null;
  onDismiss: () => void;
  onPoke: () => void;
}

/* The blue spike is the active one, the pink spike waits. Neither ever looks
   disappointed: the toy is bored, never judging. */
const ART: Record<CompanionMood, { src: string; label: string }> = {
  waiting: { src: "./assets/characters/spike-pink.png", label: "기다리는 중" },
  talking: { src: "./assets/characters/spike-pink.png", label: "말하는 중" },
  running: { src: "./assets/characters/spike-blue.png", label: "기록 중" },
};

export function Companion({ mood, runningCategory, line, onDismiss, onPoke }: CompanionProps) {
  const art = ART[mood];
  const caption = mood === "running" && runningCategory ? `${runningCategory.name} 기록 중` : art.label;

  return (
    <section className={`companion companion-${mood}`} aria-live="polite">
      {line ? (
        <div className="companion-bubble" role="status">
          <p>{line}</p>
          <button className="icon-button companion-bubble-close" type="button" aria-label="말풍선 닫기" onClick={onDismiss}>×</button>
        </div>
      ) : null}
      <button className="companion-figure" type="button" aria-label={`장난감 ${caption}. 눌러서 말 걸기`} onClick={onPoke}>
        <img src={art.src} alt="" draggable={false} />
      </button>
      <p className="companion-caption">{caption}</p>
    </section>
  );
}
