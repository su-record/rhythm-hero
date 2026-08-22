import { useEffect, useRef, useState } from "react";

import { formatMinutes, safeColor } from "../domain/format.ts";
import { TIMELINE, type DayCard, type DayMood } from "../domain/routine.ts";

const MOOD_LABEL: Record<DayMood, string> = { quiet: "조용한 하루", moving: "움직인 하루", full: "채운 하루" };
const TIMELINE_TICKS = [6, 12, 18, 24];

function dayLabel(card: DayCard, index: number): string {
  if (card.isToday) return "오늘";
  if (index === 1) return "어제";
  return new Intl.DateTimeFormat("ko-KR", { weekday: "long" }).format(card.day);
}

function dateLabel(card: DayCard): string {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(card.day);
}

function DayTimeline({ card }: { card: DayCard }) {
  const span = TIMELINE.endHour - TIMELINE.startHour;
  return (
    <div className="routine-timeline" aria-hidden="true">
      <div className="routine-timeline-track">
        {card.segments.map((segment) => (
          <span
            key={segment.sessionId}
            className={`routine-segment${segment.running ? " running" : ""}`}
            style={{
              left: `${segment.start * 100}%`,
              width: `${Math.max(1.2, (segment.end - segment.start) * 100)}%`,
              ["--category" as string]: safeColor(segment.category.color),
            }}
          />
        ))}
      </div>
      <div className="routine-timeline-ticks">
        {TIMELINE_TICKS.map((hour) => (
          <span key={hour} style={{ left: `${((hour - TIMELINE.startHour) / span) * 100}%` }}>{hour === 24 ? "24" : String(hour)}</span>
        ))}
      </div>
    </div>
  );
}

function RoutineCard({ card, index }: { card: DayCard; index: number }) {
  const lead = card.shares[0];
  const tint = lead ? safeColor(lead.category.color) : "#E6E6E1";
  const description = card.shares.length
    ? card.shares.map((share) => `${share.category.name} ${formatMinutes(share.minutes)}`).join(", ")
    : "기록 없음";

  return (
    <article
      className={`routine-card routine-card-${card.mood}${card.isToday ? " routine-card-today" : ""}`}
      style={{ ["--tint" as string]: tint }}
      aria-label={`${dayLabel(card, index)} ${dateLabel(card)}, ${formatMinutes(card.totalMinutes)}, ${description}`}
    >
      <header className="routine-card-head">
        <div>
          <p className="eyebrow">{dateLabel(card)}</p>
          <h2>{dayLabel(card, index)}</h2>
        </div>
        <span className="routine-mood">{MOOD_LABEL[card.mood]}</span>
      </header>

      <p className="routine-total">
        {card.totalMinutes > 0 ? formatMinutes(card.totalMinutes) : "0분"}
        {card.segments.some((segment) => segment.running) ? <span className="routine-live">기록 중</span> : null}
      </p>

      <DayTimeline card={card} />

      <ul className="routine-shares">
        {card.shares.length ? card.shares.map((share) => (
          <li key={share.category.id} style={{ ["--category" as string]: safeColor(share.category.color) }}>
            <span className="routine-share-dot" aria-hidden="true" />
            <span className="routine-share-name">{share.category.name}</span>
            <span className="routine-share-minutes">{formatMinutes(share.minutes)}</span>
            {share.goalRatio !== null ? (
              <span className="routine-share-goal" aria-hidden="true"><span style={{ width: `${share.goalRatio * 100}%` }} /></span>
            ) : null}
          </li>
        )) : <li className="routine-share-empty">{card.isToday ? "아직 오늘의 첫 기록을 기다리고 있어요." : "이날은 기록이 없었어요."}</li>}
      </ul>

      {card.memo ? <p className="routine-memo">“{card.memo}”</p> : null}
    </article>
  );
}

interface RoutineDeckProps {
  cards: DayCard[];
  routineLabel: string;
}

export function RoutineDeck({ cards, routineLabel }: RoutineDeckProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  // Track which card is snapped so the dots follow the swipe.
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const handleScroll = () => {
      const first = element.firstElementChild as HTMLElement | null;
      const step = first ? first.offsetWidth + 12 : element.clientWidth;
      setCurrent(Math.round(element.scrollLeft / step));
    };
    element.addEventListener("scroll", handleScroll, { passive: true });
    return () => element.removeEventListener("scroll", handleScroll);
  }, []);

  const jump = (index: number) => {
    const element = scroller.current;
    const target = element?.children[index] as HTMLElement | undefined;
    target?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };

  return (
    <section className="routine-deck" aria-labelledby="today-title">
      <div className="section-heading routine-heading">
        <div>
          <h1 id="today-title">나의 리듬</h1>
          <p>{routineLabel}</p>
        </div>
      </div>
      <div className="routine-scroller" ref={scroller} tabIndex={0} aria-label="하루 카드, 좌우로 넘겨 지난 날을 볼 수 있어요">
        {cards.map((card, index) => <RoutineCard key={card.day.getTime()} card={card} index={index} />)}
      </div>
      <div className="routine-dots" role="tablist" aria-label="날짜 선택">
        {cards.map((card, index) => (
          <button
            key={card.day.getTime()}
            type="button"
            role="tab"
            aria-selected={index === current}
            aria-label={dayLabel(card, index)}
            className={index === current ? "active" : undefined}
            onClick={() => jump(index)}
          />
        ))}
      </div>
    </section>
  );
}
