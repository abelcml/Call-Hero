export function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  const level = pct >= 80 ? 'high' : pct >= 60 ? 'mid' : 'low';
  return (
    <div className="meter">
      <div
        className="meter-track"
        role="meter"
        aria-label="AI confidence"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${pct} percent`}
      >
        <div className={`meter-fill meter-${level}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="meter-value mono">{pct}%</span>
    </div>
  );
}
