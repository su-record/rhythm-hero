import { useMemo } from "react";

import { formatReflectionMinutes, safeColor } from "../domain/format.ts";
import { getReflectionReport } from "../domain/reflection.ts";
import type { AppState, EvidenceItem, PeriodRange, ReflectionReport } from "../domain/types.ts";
import { ActivityIcon } from "../components/ActivityIcon.tsx";

function Evidence({ items }: { items: EvidenceItem[] }) {
  return (
    <dl className="reflection-evidence-grid">
      {items.map((item) => (
        <div className="reflection-evidence-item" key={`${item.label}-${item.value}`}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function AiCard({ state, report }: { state: AppState; report: ReflectionReport }) {
  const ai = state.aiReflection;
  const snapshot = ai?.factSnapshot;
  if (!ai || !snapshot?.message) return null;
  const source = snapshot.fingerprint === report.fingerprint ? "현재 기록 스냅샷" : snapshot.periodLabel || "생성 당시 스냅샷";
  const items = snapshot.evidenceItems?.length ? snapshot.evidenceItems : [{ label: "근거", value: snapshot.evidence || "생성 당시 기록" }];

  return (
    <article className="reflection-card ai-generated">
      <div className="reflection-top">
        <span className="reflection-type">AI 보조</span>
        <span className="reflection-source">{source}</span>
      </div>
      <h2>{ai.headline}</h2>
      <p>{snapshot.message}</p>
      <div className="evidence"><Evidence items={items} /></div>
    </article>
  );
}

interface ReflectionViewProps {
  state: AppState;
  active: boolean;
  aiPending: boolean;
  onSelectRange: (range: PeriodRange) => void;
  onRequestAi: () => void;
}

export function ReflectionView({ state, active, aiPending, onSelectRange, onRequestAi }: ReflectionViewProps) {
  const report = useMemo(() => getReflectionReport(state), [state]);
  const { current } = report;
  const distribution = current.categories.filter((item) => item.minutes > 0);
  const aiDisabled = current.sessionCount === 0 || aiPending;

  return (
    <section className={`view${active ? " active" : ""}`} id="view-reflections" aria-labelledby="reflection-title">
      <div className="reflection-hero">
        <div className="page-heading">
          <div>
            <p className="eyebrow">기록에서 발견한 흐름</p>
            <h1 id="reflection-title">돌아보기</h1>
          </div>
          <button className="ai-badge ai-action" type="button" disabled={aiDisabled} onClick={onRequestAi}>
            {aiPending ? "생성 중…" : current.sessionCount === 0 ? "기록이 더 필요해요" : "AI로 새로 만들기"}
          </button>
        </div>
      </div>
      <p className="page-intro reflection-intro">기록에 있는 숫자만 바탕으로, 평가 없이 시간의 패턴을 보여드립니다.</p>

      <div className="reflection-period-bar">
        <p>{report.periodLabel}</p>
        <div className="segmented" role="group" aria-label="돌아보기 기간">
          {([7, 30] as PeriodRange[]).map((range) => (
            <button
              key={range}
              className={report.range === range ? "selected" : undefined}
              type="button"
              aria-pressed={report.range === range}
              aria-controls="reflection-summary reflection-distribution reflection-list"
              onClick={() => onSelectRange(range)}
            >
              {range}일
            </button>
          ))}
        </div>
      </div>

      <section className="reflection-summary" id="reflection-summary" aria-label="선택한 기간 요약">
        <div className="reflection-summary-item"><span>총 시간</span><strong>{formatReflectionMinutes(current.totalMinutes)}</strong></div>
        <div className="reflection-summary-item"><span>활동일</span><strong>{`${current.activeDays}일`}</strong></div>
        <div className="reflection-summary-item"><span>기록 수</span><strong>{`${current.sessionCount}개`}</strong></div>
        <div className="reflection-summary-item"><span>활동일 평균</span><strong>{formatReflectionMinutes(current.activeDayAverage)}</strong></div>
      </section>

      <section className="reflection-distribution-panel" aria-labelledby="reflection-distribution-title">
        <div className="card-heading"><h2 id="reflection-distribution-title">시간 분포</h2><span>활동별로 쌓인 시간과 비율</span></div>
        <div className="reflection-distribution" id="reflection-distribution">
          {distribution.length ? distribution.map((item) => {
            const share = Math.round((item.minutes / current.totalMinutes) * 100);
            return (
              <div
                className="reflection-distribution-row"
                key={item.category.id}
                style={{ ["--category" as string]: safeColor(item.category.color), ["--share" as string]: `${share}%` }}
              >
                <div className="reflection-distribution-heading">
                  <span className="reflection-distribution-identity">
                    <ActivityIcon category={item.category} size="activity-icon-small" />
                    <strong>{item.category.name}</strong>
                  </span>
                  <span>{`${formatReflectionMinutes(item.minutes)} · ${share}%`}</span>
                </div>
                <span className="reflection-distribution-track" aria-hidden="true"><span className="reflection-distribution-fill" /></span>
              </div>
            );
          }) : <p className="reflection-empty">이 기간에는 완료된 기록이 없어요. 첫 기록이 끝나면 분포가 나타납니다.</p>}
        </div>
      </section>

      <div className="reflection-list" id="reflection-list">
        <AiCard state={state} report={report} />
        {report.facts.map((fact) => (
          <article className={`reflection-card${fact.insufficient ? " insufficient" : ""}`} key={fact.key}>
            <div className="reflection-top">
              <span className="reflection-type">{fact.type}</span>
              <span className="reflection-source">{report.periodLabel}</span>
            </div>
            <h2>{fact.message}</h2>
            <p>{fact.description}</p>
            <div className="evidence"><Evidence items={fact.evidenceItems} /></div>
          </article>
        ))}
      </div>
    </section>
  );
}
