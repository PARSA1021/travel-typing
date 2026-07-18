import { ArrowLeft, ArrowRight, Bus, Plane, Flame, Lightbulb, Volume2, VolumeX } from "lucide-react";
import { TravelMap } from "./TravelMap";
import { ArrivalPopup } from "./ArrivalPopup";
import { SplitFlap } from "./SplitFlap";
import { TRAVEL_MODES } from "../lib/geo";
import { getCountryAccentClass } from "../lib/Countrytheme.js";
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
  const difficulty = useGameStore((state) => state.difficulty);
  const soundOn = useGameStore((state) => state.soundOn);
  const setSoundOn = useGameStore((state) => state.setSoundOn);
  const stop = stops[stopIndex];
  const next = stops[stopIndex + 1] ?? null;
  const prev = stops[stopIndex - 1] ?? null;
  const targetCharacters = [...target];
  const isKorean = typingLanguage === "ko";
  const upcomingMode = next?.mode;
  const countryClass = getCountryAccentClass(stop?.country);

  const fitFontSize = `clamp(1.4rem, ${(400 / (targetCharacters.length * (isKorean ? 1 : 0.62))).toFixed(2)}px, 4.5rem)`;

  const typingInstruction = isKorean
    ? `${stop?.name_ko}를 입력하세요`
    : `${stop?.name_ko}, 영문 지명 ${stop?.name_en}을 입력하세요`;

  return (
    <section className={`game-screen-fullscreen ${countryClass} ${shake ? "error-flash" : ""}`} onClick={onFocusTyping}>
      <p className="screen-reader-status" aria-live="polite" aria-atomic="true">
        현재 위치 {typingInstruction}
      </p>

      <div className="map-layer">
        <TravelMap 
          countries={countries} 
          stops={stops} 
          stopIndex={stopIndex} 
          shake={shake}
          arrivalStop={arrivalStop} 
        />
        <ArrivalPopup stop={arrivalStop} visible={Boolean(arrivalStop)} />
      </div>

      <header className="game-header-floating">
        <div className="header-left">
          <button className="pill-button" type="button" onClick={(e) => { e.stopPropagation(); onBack(); }}>
            나가기
          </button>
          <button
            className="mute-toggle"
            type="button"
            aria-pressed={soundOn}
            aria-label={soundOn ? "효과음 끄기" : "효과음 켜기"}
            onClick={(e) => { e.stopPropagation(); setSoundOn(!soundOn); }}
          >
            {soundOn ? <Volume2 size={15} aria-hidden="true" /> : <VolumeX size={15} aria-hidden="true" />}
          </button>
          <span className="brand-text">TRAVEL TYPING</span>
        </div>

        <div className="header-center">
          <div className="progress-bar-container">
            <span>여정 진행 중</span>
            <div className="progress-track" role="progressbar" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={stops.length}>
              <div className="progress-fill" style={{ width: `${(completed / stops.length) * 100}%` }} />
            </div>
            <span><SplitFlap value={completed} /> / {stops.length}</span>
          </div>
        </div>

        <div className="header-right">
          <div className="status-pill">
            <span>정확도</span>
            <strong><SplitFlap value={metrics.accuracy} />%</strong>
          </div>
          <div className={`status-pill ${metrics.combo >= 10 ? "is-hot" : ""}`}>
            <span><Flame size={12} aria-hidden="true" /> 콤보</span>
            <strong><SplitFlap value={metrics.combo} /></strong>
          </div>
          <div className="status-pill">
            <span>속도</span>
            <strong><SplitFlap value={metrics.speed} /> {metrics.speedUnit}</strong>
          </div>
        </div>
      </header>

      <div className={`floating-bottom-ui ${shake ? "shake" : ""}`}>

        {/* Helper popup just above the pill */}
        <div className="helper-popup">
          <div className="timer-badge">
            <span className="timer-label">{mode === "timed" ? "남은 시간" : "운행 시간"}</span>
            <span className="timer-value"><SplitFlap value={mode === "timed" ? remaining : elapsed} /></span>
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
              <h2>{stop?.name_ko}</h2>
              <p>{stop?.name_en}</p>
            </div>

            <div
              className={`typing-target-modern ${isKorean ? "is-korean" : ""}`}
              style={{ "--fit-font": fitFontSize }}
              title="백스페이스로 되돌릴 수 있어요"
            >
              {targetCharacters.map((character, index) => {
                const isTyped = index < typedIndex;
                const isCurrent = index === typedIndex;
                // 한글 조합 중엔 이 칸에 완성 여부와 상관없이 지금 조합
                // 버퍼를 그대로 보여준다. typedIndex는 실제 확정(commit)
                // 시점에만 움직이므로, 이건 순전히 "지금 뭘 치고 있는지"를
                // 보여주는 시각적 미리보기일 뿐 카운트에는 영향을 주지 않는다.
                const isComposingHere = isCurrent && isKorean && Boolean(compositionText);
                const isHidden = difficulty === "advanced" && index > 0 && !isTyped && character !== " ";

                let className = "";
                if (isTyped) className = "typed particle-pop";
                else if (isComposingHere) className = "current is-composing";
                else if (isCurrent) className = "current";
                else if (isHidden) className = "hint-hidden";

                if (character === " ") className += " is-space";

                let content;
                if (isComposingHere) content = compositionText;
                else if (isHidden) content = "•";
                else if (character === " ") content = isCurrent ? "␣" : "\u00A0";
                else content = character;

                return (
                  <span 
                    key={`${character}-${index}`} 
                    className={className}
                  >
                    {content}
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