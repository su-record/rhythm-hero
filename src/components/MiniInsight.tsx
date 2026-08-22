interface MiniInsightProps {
  message: string;
  onOpenReflections: () => void;
}

export function MiniInsight({ message, onOpenReflections }: MiniInsightProps) {
  return (
    <section className="mini-insight">
      <div className="mini-insight-copy">
        <p className="eyebrow">기록에서 발견한 점</p>
        <p>{message}</p>
      </div>
      <button className="text-button" type="button" onClick={onOpenReflections}>자세히</button>
    </section>
  );
}
