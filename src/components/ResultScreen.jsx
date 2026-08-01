import { useEffect, useState } from "react";
import { Home, RotateCcw, BadgeCheck, Trophy, Sparkles } from "lucide-react";
import { SplitFlap } from "./SplitFlap";

function getTravelGrade(speed, accuracy, isKorean) {
  const normSpeed = isKorean ? speed : speed * 5;
  if (normSpeed >= 350 && accuracy >= 98) return { rank: "S+", title: "베테랑 유럽 여행가 🏆" };
  if (normSpeed >= 260 && accuracy >= 95) return { rank: "S", title: "낭만적인 유럽 감성 여행가 ✈️" };
  if (normSpeed >= 180 && accuracy >= 90) return { rank: "A", title: "즐거운 유럽 탐험가 🧳" };
  return { rank: "B", title: "설레는 첫 걸음 여행가 🌱" };
}

export function ResultScreen({ elapsed, completed, metrics, onBack, onRetry }) {
  const isKorean = metrics.speedUnit === "타/분";
  const grade = getTravelGrade(metrics.speed, metrics.accuracy, isKorean);

  const stats = [
    { key: "completed", label: "방문한 여행지", value: completed, unit: "곳" },
    { key: "distance", label: "총 이동 거리", value: metrics.distance || 0, unit: "km" },
    { key: "elapsed", label: "소요 시간", value: elapsed, unit: "초" },
    { key: "speed", label: "타이핑 속도", value: metrics.speed, unit: metrics.speedUnit },
    { key: "accuracy", label: "정확도", value: metrics.accuracy, unit: "%" },
    { key: "maxCombo", label: "최대 콤보", value: metrics.maxCombo || 0, unit: "🔥" },
  ];

  return (
    <div className="result">
      <div className="result-seal" aria-hidden="true">
        <BadgeCheck size={26} />
        <span>PASSPORT<br/>STAMP</span>
      </div>
      <p className="result-eyebrow">BOARDING COMPLETE</p>
      <h1>여행을 성공적으로 마쳤습니다 🧳</h1>
      
      <div className="result-grade-badge">
        <span className="grade-rank">{grade.rank}</span>
        <span className="grade-title">{grade.title}</span>
      </div>

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
  const [currentValue, setCurrentValue] = useState(0);

  useEffect(() => {
    let startTime;
    let animationFrame;
    const duration = 1200; // 1.2s counting animation

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out quartic for a satisfying slowdown
      const easeOut = 1 - Math.pow(1 - progress, 4);
      setCurrentValue(Math.floor(easeOut * value));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCurrentValue(value); // ensure final exact value
      }
    };

    const timer = setTimeout(() => {
      animationFrame = requestAnimationFrame(animate);
    }, 150 + revealDelay);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(animationFrame);
    };
  }, [value, revealDelay]);

  return (
    <div className="result-stat" role="listitem">
      <small>{label}</small>
      <strong><SplitFlap value={currentValue} /></strong>
      <span>{unit}</span>
    </div>
  );
}