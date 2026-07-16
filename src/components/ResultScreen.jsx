import { Home, RotateCcw } from "lucide-react";

export function ResultScreen({ elapsed, completed, metrics, onBack, onRetry }) {
  return (
    <div className="result">
      <p className="result-eyebrow">TRIP COMPLETE</p>
      <h1>여행을 마쳤습니다 🧳</h1>
      <div className="result-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <ResultStat label="방문한 여행지" value={completed} unit="곳" />
        <ResultStat label="소요 시간" value={elapsed} unit="초" />
        <ResultStat label="타이핑 속도" value={metrics.speed} unit={metrics.speedUnit} />
        <ResultStat label="정확도" value={metrics.accuracy} unit="%" />
        <ResultStat label="최대 콤보" value={metrics.maxCombo || 0} unit="🔥" />
      </div>
      <div className="result-actions">
        <button type="button" className="secondary-button" onClick={onBack}>
          <Home size={16} /> 홈으로
        </button>
        <button type="button" className="start-button" onClick={onRetry}>
          <RotateCcw size={16} /> 다시 여행하기
        </button>
      </div>
    </div>
  );
}

function ResultStat({ label, value, unit }) {
  return (
    <div className="result-stat">
      <small>{label}</small>
      <strong>{value}</strong>
      <span>{unit}</span>
    </div>
  );
}
