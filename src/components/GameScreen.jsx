import { ArrowLeft, ArrowRight, Bus, Plane, Flame, Lightbulb } from "lucide-react";
import { TravelMap } from "./TravelMap";
import { ArrivalPopup } from "./ArrivalPopup";
import { TRAVEL_MODES } from "../lib/geo";
import { getCountryAccentClass } from "../lib/Countrytheme";
import { useGameStore } from "../store/useGameStore";

export function GameScreen({
  countries,
  stops,
  stopIndex,
  typedIndex,
  target,
  typingLanguage,
  compositionText,
  completed,
  remaining,
  elapsed,
  mode,
  metrics,
  shake,
  arrivalStop,
  onBack,
  onFocusTyping,
}) {
  const { difficulty } = useGameStore();
  const stop = stops[stopIndex];
  const next = stops[stopIndex + 1] ?? null;
  const prev = stops[stopIndex - 1] ?? null;
  const targetCharacters = [...target];
  const journeyProgress = targetCharacters.length ? typedIndex / targetCharacters.length : 0;
  const isKorean = typingLanguage === "ko";
  const upcomingMode = next?.mode;
  const countryClass = getCountryAccentClass(stop.country);

  // 글자 수에 비례해 자동으로 줄어들되, 너무 작아지거나 너무 커지지 않도록
  // 상/하한을 둔다. (기존 calc(400px / n)은 글자 수가 아주 많거나 적을 때
  // 폭주하거나 뭉개질 수 있었다.)
  const fitFontSize = `clamp(1.4rem, ${(400 / (targetCharacters.length * (isKorean ? 1 : 0.62))).toFixed(2)}px, 4.5rem)`;

  // 목적지 이름과 "무엇을 입력해야 하는지"가 같은 언어일 때 중복 안내되던 문제 수정
  const typingInstruction = isKorean
    ? `${stop.name_ko}를 입력하세요`
    : `${stop.name_ko}, 영문 지명 ${stop.name_en}을 입력하세요`;

  return (
    <section className={`game-screen-fullscreen ${countryClass} ${shake ? "error-flash" : ""}`} onClick={onFocusTyping}>
      <p className="screen-reader-status" aria-live="polite" aria-atomic="true">
        현재 위치 {typingInstruction}
      </p>

      <div className="map-layer">
        <TravelMap countries={countries} stops={stops} stopIndex={stopIndex} journeyProgress={journeyProgress} shake={shake} />
        <ArrivalPopup stop={arrivalStop} visible={Boolean(arrivalStop)} />
      </div>

      <header className="game-header-floating">
        <div className="header-left">
          <button className="pill-button" type="button" onClick={(e) => { e.stopPropagation(); onBack(); }}>
            나가기
          </button>
          <span className="brand-text">TRAVEL TYPING</span>
        </div>

        <div className="header-center">
          <div className="progress-bar-container">
            <span>여정 진행 중</span>
            <div className="progress-track" role="progressbar" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={stops.length}>
              <div className="progress-fill" style={{ width: `${(completed / stops.length) * 100}%` }} />
            </div>
            <span>{completed} / {stops.length}</span>
          </div>
        </div>

        <div className="header-right">
          <div className="status-pill">
            <span>정확도</span>
            <strong>{metrics.accuracy}%</strong>
          </div>
          <div className={`status-pill ${metrics.combo >= 10 ? "is-hot" : ""}`}>
            <span><Flame size={12} aria-hidden="true" /> 콤보</span>
            <strong>{metrics.combo}</strong>
          </div>
          <div className="status-pill">
            <span>속도</span>
            <strong>{metrics.speed} {metrics.speedUnit}</strong>
          </div>
        </div>
      </header>

      <div className={`floating-bottom-ui ${shake ? "shake" : ""}`}>

        {/* Helper popup just above the pill */}
        <div className="helper-popup">
          <div className="timer-badge">
            <span className="timer-label">{mode === "timed" ? "남은 시간" : "운행 시간"}</span>
            <span className="timer-value">{mode === "timed" ? remaining : elapsed}</span>
          </div>
          {next ? (
            <div className="transport-badge">
              {upcomingMode === TRAVEL_MODES.PLANE ? <Plane size={14} aria-hidden="true" /> : <Bus size={14} aria-hidden="true" />}
              <span>{upcomingMode === TRAVEL_MODES.PLANE ? "국가 이동 (비행기)" : "시내 이동 (버스)"}</span>
            </div>
          ) : (
            <div className="transport-badge is-final">
              <span>🏁 마지막 목적지</span>
            </div>
          )}
        </div>

        <div className="bottom-pill-container">

          <div className="side-section left-section">
            <ArrowLeft size={24} className="nav-icon" aria-hidden="true" />
            <div className="side-info">
              <span>이전 목적지</span>
              <strong>{prev ? prev.name_ko : "출발점"}</strong>
              <small>{prev ? prev.name_en : ""}</small>
            </div>
          </div>

          <div className="center-section">
            <div className="current-stop-title">
              <h2>{stop.name_ko}</h2>
              <p>{stop.name_en}</p>
            </div>

            <div
              className={`typing-target-modern ${isKorean ? "is-korean" : ""}`}
              style={{ "--fit-font": fitFontSize }}
              title="백스페이스로 되돌릴 수 있어요"
            >
              {targetCharacters.map((character, index) => {
                const isHidden = difficulty === "advanced" && index > 0 && index >= typedIndex && character !== " ";
                let className = index < typedIndex ? "typed particle-pop" : index === typedIndex ? "current" : (isHidden ? "hint-hidden" : "");
                if (character === " ") className += " is-space";

                return (
                  <span key={`${character}-${index}`} className={className}>
                    {isHidden ? "•" : character === " " ? (index === typedIndex ? "␣" : "\u00A0") : character}
                  </span>
                );
              })}
            </div>

            <div className="composition-modern">
              {isKorean ? (
                compositionText ? (
                  <><span className="typing-now">입력 중</span> <strong>{compositionText}</strong></>
                ) : (
                  <span>한글 입력기로 시작하세요</span>
                )
              ) : (
                <span>화면의 영문 지명을 입력하세요</span>
              )}
              {difficulty === "advanced" && (
                <span className="advanced-hint"><Lightbulb size={12} aria-hidden="true" /> 첫 글자 힌트 모드</span>
              )}
            </div>
          </div>

          <div className="side-section right-section">
            <div className="side-info right-align">
              <span>다음 목적지</span>
              <strong>{next ? next.name_ko : "여정의 끝"}</strong>
              <small>{next ? next.name_en : "도착"}</small>
            </div>
            <ArrowRight size={24} className="nav-icon" aria-hidden="true" />
          </div>

        </div>
      </div>
    </section>
  );
}