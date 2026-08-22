import { formatReflectionMinutes, formatReflectionPeriod } from "./format.ts";
import { allCompleted } from "./stats.ts";
import { overlapMsForDay, overlapMsForPeriod, periodBounds } from "./time.ts";
import type { AppState, CategoryShare, PeriodRange, ReflectionFact, ReflectionReport, ReflectionStats, Session } from "./types.ts";

interface RuleContext {
  range: PeriodRange;
  current: ReflectionStats;
  previous: ReflectionStats;
  periodEvidence: string;
}

/** A rule reads two adjacent periods and returns exactly one evidence card. */
type ReflectionRule = (context: RuleContext) => ReflectionFact;

function categoryShares(state: AppState, sessions: Session[], bounds: ReflectionStats["bounds"]): CategoryShare[] {
  return state.categories
    .map((category) => {
      const categorySessions = sessions.filter((session) => session.categoryId === category.id);
      const minutes = categorySessions.reduce((sum, session) => sum + overlapMsForPeriod(session, bounds) / 60_000, 0);
      return { category, minutes, sessionCount: new Set(categorySessions.map((session) => session.id)).size };
    })
    .sort((left, right) => right.minutes - left.minutes);
}

export function getReflectionPeriodStats(state: AppState, range: PeriodRange, offsetPeriods = 0): ReflectionStats {
  const bounds = periodBounds(range, offsetPeriods);
  const completed = allCompleted(state);
  const sessions = completed.filter((session) => overlapMsForPeriod(session, bounds) > 0);
  const categories = categoryShares(state, sessions, bounds);
  const totalMinutes = categories.reduce((sum, item) => sum + item.minutes, 0);
  const days = Array.from({ length: bounds.range }, (_, index) => {
    const day = new Date(bounds.start);
    day.setDate(day.getDate() + index);
    return day;
  });
  const activeDays = days.filter((day) => completed.some((session) => overlapMsForDay(session, day) > 0)).length;
  const uniqueSessions = [...new Map(sessions.map((session) => [session.id, session])).values()];
  const startedSessions = uniqueSessions.filter((session) => {
    const startedAt = new Date(session.startedAt).getTime();
    return startedAt >= bounds.start.getTime() && startedAt < bounds.end.getTime();
  });
  return {
    bounds,
    periodLabel: formatReflectionPeriod(bounds),
    totalMinutes,
    activeDays,
    activeDayAverage: activeDays ? totalMinutes / activeDays : 0,
    sessionCount: uniqueSessions.length,
    startedSessions,
    categories,
  };
}

export function createReflectionFingerprint(facts: ReflectionFact[]): string {
  const value = JSON.stringify(facts.map(({ key, message, evidence }) => ({ key, message, evidence })));
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return `reflection-v1-${(hash >>> 0).toString(36)}`;
}

function emptyComparison({ range, previous, periodEvidence }: RuleContext): ReflectionFact {
  return {
    key: "comparison",
    type: "최근 대비",
    message: "선택한 기간에는 완료된 기록이 없어 직전 기간과의 변화를 계산하지 않았어요.",
    description: "첫 완료 기록이 생기면 같은 길이의 직전 기간과 비교합니다.",
    evidence: `${periodEvidence} · 현재 0분 · 이전 ${formatReflectionMinutes(previous.totalMinutes)}`,
    evidenceItems: [
      { label: "현재", value: "0분" },
      { label: "이전", value: formatReflectionMinutes(previous.totalMinutes) },
      { label: "기간", value: `${range}일` },
    ],
    insufficient: true,
  };
}

function firstPeriodComparison({ current, periodEvidence }: RuleContext): ReflectionFact {
  return {
    key: "comparison",
    type: "최근 대비",
    message: `선택한 기간에는 ${formatReflectionMinutes(current.totalMinutes)}이 쌓였고, 직전 같은 기간에는 비교할 기록이 없어요.`,
    description: "변화율 대신 확인 가능한 두 기간의 시간을 그대로 보여드립니다.",
    evidence: `${periodEvidence} · 현재 ${formatReflectionMinutes(current.totalMinutes)} · 이전 0분`,
    evidenceItems: [
      { label: "현재", value: formatReflectionMinutes(current.totalMinutes) },
      { label: "이전", value: "0분" },
      { label: "기록 수", value: `${current.sessionCount}개` },
    ],
    insufficient: true,
  };
}

function periodComparison({ current, previous, periodEvidence }: RuleContext): ReflectionFact {
  const difference = current.totalMinutes - previous.totalMinutes;
  const differencePercent = Math.round((difference / previous.totalMinutes) * 100);
  const signed = `${differencePercent > 0 ? "+" : ""}${differencePercent}%`;
  return {
    key: "comparison",
    type: "최근 대비",
    message: Math.abs(difference) < 1
      ? "직전 같은 기간과 거의 같은 만큼의 시간이 기록됐어요."
      : `직전 같은 기간보다 ${formatReflectionMinutes(Math.abs(difference))} ${difference > 0 ? "더" : "덜"} 기록됐어요.`,
    description: "같은 길이의 연속된 두 기간에서 완료된 시간을 비교했습니다.",
    evidence: `${periodEvidence} · 현재 ${formatReflectionMinutes(current.totalMinutes)} · 이전 ${formatReflectionMinutes(previous.totalMinutes)} · ${signed}`,
    evidenceItems: [
      { label: "현재", value: formatReflectionMinutes(current.totalMinutes) },
      { label: "이전", value: formatReflectionMinutes(previous.totalMinutes) },
      { label: "변화", value: signed },
    ],
  };
}

const comparisonRule: ReflectionRule = (context) => {
  if (!context.current.totalMinutes) return emptyComparison(context);
  if (!context.previous.totalMinutes) return firstPeriodComparison(context);
  return periodComparison(context);
};

const topShareRule: ReflectionRule = ({ range, current, periodEvidence }) => {
  const leading = current.categories.find((item) => item.minutes > 0);
  if (!leading) {
    return {
      key: "top-share",
      type: "활동 비율",
      message: "활동별 분포를 계산하려면 완료된 기록이 필요해요.",
      description: "첫 기록이 끝나면 활동별 시간과 비율을 나눠 보여드립니다.",
      evidence: `${periodEvidence} · 완료 기록 0개`,
      evidenceItems: [{ label: "완료 기록", value: "0개" }, { label: "기간", value: `${range}일` }],
      insufficient: true,
    };
  }
  const share = Math.round((leading.minutes / current.totalMinutes) * 100);
  return {
    key: "top-share",
    type: "활동 비율",
    message: `${leading.category.name}에 ${formatReflectionMinutes(leading.minutes)}이 쌓여 전체의 ${share}%를 차지했어요.`,
    description: "선택한 기간의 총 기록 시간에서 이 활동이 차지한 비율입니다.",
    evidence: `${periodEvidence} · ${leading.category.name} ${formatReflectionMinutes(leading.minutes)} / 전체 ${formatReflectionMinutes(current.totalMinutes)} · 기록 ${leading.sessionCount}개`,
    evidenceItems: [
      { label: "활동", value: leading.category.name },
      { label: "시간", value: formatReflectionMinutes(leading.minutes) },
      { label: "비율", value: `${share}%` },
    ],
  };
};

const TIME_BANDS = [
  { label: "새벽", start: 0, end: 6 },
  { label: "오전", start: 6, end: 12 },
  { label: "오후", start: 12, end: 18 },
  { label: "저녁", start: 18, end: 24 },
];

function countByTimeBand(sessions: Session[]): Array<{ label: string; count: number }> {
  return TIME_BANDS.map((band) => ({
    label: band.label,
    count: sessions.filter((session) => {
      const hour = new Date(session.startedAt).getHours();
      return hour >= band.start && hour < band.end;
    }).length,
  }));
}

const RHYTHM_MINIMUM_SESSIONS = 3;

const rhythmRule: ReflectionRule = ({ current, periodEvidence }) => {
  const bands = countByTimeBand(current.startedSessions);
  const bandEvidence = bands.map((band) => `${band.label} ${band.count}개`).join(" · ");
  if (current.startedSessions.length < RHYTHM_MINIMUM_SESSIONS) {
    const needed = RHYTHM_MINIMUM_SESSIONS - current.startedSessions.length;
    return {
      key: "rhythm",
      type: "시작 리듬",
      message: `시작 시간의 흐름을 보려면 완료 기록이 ${needed}개 더 필요해요.`,
      description: "완료 기록 3개부터 시작 시간대의 분포를 관찰합니다.",
      evidence: `${periodEvidence} · 기간 안에서 시작한 기록 ${current.startedSessions.length}개 · ${bandEvidence}`,
      evidenceItems: [
        { label: "시작 기록", value: `${current.startedSessions.length}개` },
        { label: "필요한 기록", value: `${needed}개` },
        { label: "기준", value: "완료 3개" },
      ],
      insufficient: true,
    };
  }
  const maxCount = Math.max(...bands.map((band) => band.count));
  const leaders = bands.filter((band) => band.count === maxCount);
  return {
    key: "rhythm",
    type: "시작 리듬",
    message: leaders.length === 1
      ? `${leaders[0]?.label}에 시작한 기록이 ${maxCount}개로 가장 많았어요.`
      : `기록 시작이 ${leaders.map((band) => band.label).join("·")} 시간대에 고르게 나타났어요.`,
    description: "완료 기록의 시작 시각을 네 시간대로 나눠 관찰했습니다.",
    evidence: `${periodEvidence} · ${bandEvidence}`,
    evidenceItems: bands.map((band) => ({ label: band.label, value: `${band.count}개` })),
  };
};

/** Add a rule here and a new evidence card appears; no other rule needs editing. */
export const REFLECTION_RULES: ReflectionRule[] = [comparisonRule, topShareRule, rhythmRule];

export function getReflectionReport(state: AppState): ReflectionReport {
  const range: PeriodRange = state.reflectionRange === 30 ? 30 : 7;
  const current = getReflectionPeriodStats(state, range);
  const previous = getReflectionPeriodStats(state, range, 1);
  const context: RuleContext = { range, current, previous, periodEvidence: `${current.periodLabel} · ${range}일` };
  const facts = REFLECTION_RULES.map((rule) => rule(context));
  return {
    range,
    current,
    previous,
    periodLabel: context.periodEvidence,
    facts,
    fingerprint: createReflectionFingerprint(facts),
  };
}
