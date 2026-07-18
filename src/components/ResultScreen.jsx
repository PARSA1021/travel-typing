import { useEffect, useState } from "react";
import { Home, RotateCcw, BadgeCheck } from "lucide-react";
import { SplitFlap } from "./SplitFlap";

export function ResultScreen({ elapsed, completed, metrics, onBack, onRetry }) {
  const stats = [
    { key: "completed", label: "방문한 여행지", value: completed, unit: "곳" },
    { key: "elapsed", label: "소요 시간", value: elapsed, unit: "초" },
    { key: "speed", label: "타이핑 속도", value: metrics.speed, unit: metrics.speedUnit },
    { key: "accuracy", label: "정확도", value: metrics.accuracy, unit: "%" },
    { key: "maxCombo", label: "최대 콤보", value: metrics.maxCombo || 0, unit: "🔥" },
  ];

  return (
    <div className="result">
      <div className="result-seal" aria-hidden="true">
        <BadgeCheck size={26} />
        <span>PASSPORT<br/>CONTROL</span>
      </div>
      <p className="result-eyebrow">BOARDING COMPLETE</p>
      <h1>여행을 마쳤습니다 🧳</h1>
      <div className="result-grid" role="list">
        {stats.map((stat, index) => (
          <ResultStat key={stat.key} {...stat} revealDelay={index * 90} />
        ))}
      </div>
      <div className="result-actions">
        <button type="button" className="secondary-button" onClick={onBack}>
          <Home size={16} aria-hidden="true" /> 홈으로
        </button>
        <button type="button" className="start-button" onClick={onRetry}>
          <RotateCcw size={16} aria-hidden="true" /> 다시 여행하기
        </button>
      </div>
    </div>
  );
}

function ResultStat({ label, value, unit, revealDelay = 0 }) {
  // 도착 전광판처럼, 화면에 들어오는 순간 0에서 실제 값으로 순서대로
  // 갈리며 나타난다.
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 150 + revealDelay);
    return () => clearTimeout(timer);
  }, [revealDelay]);

  return (
    <div className="result-stat" role="listitem">
      <small>{label}</small>
      <strong><SplitFlap value={revealed ? value : 0} /></strong>
      <span>{unit}</span>
    </div>
  );
}