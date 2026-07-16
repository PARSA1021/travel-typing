import { useEffect, useMemo, useState } from "react";
import { Shuffle, ChevronRight, Map, Star, Award, Settings2, Play, MapPin, Plane, Moon, Sun } from "lucide-react";
import { TYPING_LANGUAGES } from "../lib/typing";
import { useGameStore } from "../store/useGameStore";

const GAME_TYPES = {
  ROUTE: "route",
  GRAND_TOUR: "grand-tour",
  FREE_RIDE: "free-ride",
};

export { GAME_TYPES };

const COUNTRY_COLORS = {
  France: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
  "France · Switzerland": "linear-gradient(135deg, #3B82F6 0%, #10B981 100%)",
  Italy: "linear-gradient(135deg, #EF4444 0%, #F97316 100%)",
  Switzerland: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
};

const DAY_MS = 86400000;

export function HomeScreen({
  routes,
  gameType,
  onGameTypeChange,
  selectedRouteId,
  onSelectRoute,
  timerMode,
  onTimerModeChange,
  typingLanguage,
  onTypingLanguageChange,
  onStart,
}) {
  const [showSettings, setShowSettings] = useState(false);
  const {
    difficulty: storedDifficulty,
    setDifficulty: setStoreDifficulty,
    dark,
    setDark,
  } = useGameStore();

  // 스토어에 이미 저장된 난이도가 있으면 그걸로 초기화한다.
  // (이전에는 항상 "beginner"로 고정되어, 새로고침 후에도 화면이 실제 저장된
  // 난이도를 반영하지 못하는 문제가 있었다.)
  const [difficulty, setDifficulty] = useState(storedDifficulty || "beginner");

  // 오늘의 추천 코스: routes가 바뀌지 않는 한 하루에 한 번만 다시 계산한다.
  const todaysRoute = useMemo(() => {
    if (!routes.length) return null;
    return routes[Math.floor(Date.now() / DAY_MS) % routes.length];
  }, [routes]);

  // 설정 시트가 열려 있을 때 Esc로 닫을 수 있게 한다.
  useEffect(() => {
    if (!showSettings) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setShowSettings(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showSettings]);

  const handleRouteSelect = (routeId) => {
    onGameTypeChange(GAME_TYPES.ROUTE);
    onSelectRoute(routeId);
    setShowSettings(true);
  };

  const handleDifficultySelect = (level) => {
    setDifficulty(level);
    setStoreDifficulty(level);
    if (level === "beginner" || level === "intermediate") {
      onTypingLanguageChange(TYPING_LANGUAGES.KOREAN);
    } else {
      onTypingLanguageChange(TYPING_LANGUAGES.ENGLISH);
    }
  };

  const canStart = gameType !== GAME_TYPES.ROUTE || Boolean(selectedRouteId);

  return (
    <div className="home-album">
      <div className="home-top-actions">
        <button
          className="icon-button"
          type="button"
          aria-pressed={dark}
          aria-label="다크모드 전환"
          onClick={() => setDark(!dark)}
        >
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
      <section className="album-hero">
        <div className="hero-badge">✈️ MY TRAVEL TYPING</div>
        <h1 className="album-title">유럽 여행을<br/>타이핑으로 떠나요</h1>
        <p className="album-sub">
          프랑스, 스위스, 이탈리아의 아름다운 여행지를<br/>
          손끝으로 방문하세요.
        </p>
      </section>

      {/* Today's pick */}
      {todaysRoute ? (
        <section className="album-todays-pick">
          <button
            type="button"
            className="todays-pick-card"
            onClick={() => handleRouteSelect(todaysRoute.id)}
          >
            <div className="pick-left">
              <div className="pick-badge">
                <Star size={14} fill="currentColor" aria-hidden="true" /> 오늘의 추천
              </div>
              <h2>{todaysRoute.title}</h2>
              <p>{todaysRoute.country} · {todaysRoute.stops.length}곳</p>
            </div>
            <div className="pick-right">
              <span className="pick-flag">{todaysRoute.countryFlag}</span>
              <ChevronRight size={20} aria-hidden="true" />
            </div>
          </button>
        </section>
      ) : null}

      {/* Route gallery */}
      <section className="album-gallery-section">
        <h3 className="section-title">
          <MapPin size={20} aria-hidden="true" /> 여행 코스
        </h3>
        <div className="album-gallery">
          {routes.map((route) => (
            <button
              key={route.id}
              type="button"
              className={`album-card ${selectedRouteId === route.id ? "is-selected" : ""}`}
              aria-pressed={selectedRouteId === route.id}
              onClick={() => handleRouteSelect(route.id)}
            >
              <div
                className="album-card-image"
                style={{ background: COUNTRY_COLORS[route.country] || COUNTRY_COLORS.Italy }}
              >
                <span className="album-card-flag">{route.countryFlag}</span>
                <span className="album-card-stops">{route.stops.length} Places</span>
              </div>
              <div className="album-card-content">
                <h4 className="album-card-title">{route.title}</h4>
                <p className="album-card-meta">{route.country}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Special modes */}
      <section className="album-special-modes">
        <h3 className="section-title">
          <Plane size={20} aria-hidden="true" /> 스페셜 모드
        </h3>
        <div className="special-modes-grid">
          <button
            type="button"
            className={`special-mode-card ${gameType === GAME_TYPES.GRAND_TOUR ? "is-active" : ""}`}
            aria-pressed={gameType === GAME_TYPES.GRAND_TOUR}
            onClick={() => {
              onGameTypeChange(GAME_TYPES.GRAND_TOUR);
              setShowSettings(true);
            }}
          >
            <div className="sm-icon grand-tour"><Map size={24} aria-hidden="true" /></div>
            <div className="sm-info">
              <strong>유럽 그랜드투어</strong>
              <span>모든 코스를 한 번에 정복</span>
            </div>
          </button>
          <button
            type="button"
            className={`special-mode-card ${gameType === GAME_TYPES.FREE_RIDE ? "is-active" : ""}`}
            aria-pressed={gameType === GAME_TYPES.FREE_RIDE}
            onClick={() => {
              onGameTypeChange(GAME_TYPES.FREE_RIDE);
              onTimerModeChange("timed");
              setShowSettings(true);
            }}
          >
            <div className="sm-icon free-ride"><Shuffle size={24} aria-hidden="true" /></div>
            <div className="sm-info">
              <strong>자유 주행 (30초)</strong>
              <span>무작위 타임어택</span>
            </div>
          </button>
        </div>
      </section>

      {/* Bottom Sheet (settings) */}
      <div className={`album-bottom-sheet ${showSettings ? "is-open" : ""}`}>
        <div
          className="sheet-backdrop"
          onClick={() => setShowSettings(false)}
          aria-hidden="true"
        />
        <div
          className="sheet-content"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sheet-title"
        >
          <div className="sheet-header">
            <div className="sheet-handle" aria-hidden="true" />
            <h3 id="sheet-title">여행 준비하기</h3>
          </div>

          <div className="sheet-body">
            <div className="setting-group">
              <label><Award size={16} aria-hidden="true" /> 난이도 선택</label>
              <div className="difficulty-options" role="radiogroup" aria-label="난이도 선택">
                <button
                  type="button"
                  role="radio"
                  aria-checked={difficulty === "beginner"}
                  className={`diff-btn ${difficulty === "beginner" ? "active" : ""}`}
                  onClick={() => handleDifficultySelect("beginner")}
                >
                  <span className="diff-icon">🌱</span>
                  <strong>초급</strong>
                  <small>한글 지명</small>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={difficulty === "intermediate"}
                  className={`diff-btn ${difficulty === "intermediate" ? "active" : ""}`}
                  onClick={() => handleDifficultySelect("intermediate")}
                >
                  <span className="diff-icon">🧭</span>
                  <strong>중급</strong>
                  <small>한글 + 영문 힌트</small>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={difficulty === "advanced"}
                  className={`diff-btn ${difficulty === "advanced" ? "active" : ""}`}
                  onClick={() => handleDifficultySelect("advanced")}
                >
                  <span className="diff-icon">🔥</span>
                  <strong>상급</strong>
                  <small>영문 블라인드</small>
                </button>
              </div>
            </div>

            <div className="setting-group">
              <label><Settings2 size={16} aria-hidden="true" /> 게임 방식</label>
              <div className="toggle-group" role="radiogroup" aria-label="게임 방식">
                <button
                  type="button"
                  role="radio"
                  aria-checked={timerMode === "line"}
                  className={`toggle-btn ${timerMode === "line" ? "active" : ""}`}
                  onClick={() => onTimerModeChange("line")}
                >
                  코스 완주
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={timerMode === "timed"}
                  className={`toggle-btn ${timerMode === "timed" ? "active" : ""}`}
                  onClick={() => onTimerModeChange("timed")}
                >
                  30초 타임어택
                </button>
              </div>
            </div>
          </div>

          <div className="sheet-footer">
            <button type="button" className="start-journey-btn" disabled={!canStart} onClick={onStart}>
              <Play size={18} fill="currentColor" aria-hidden="true" /> 출발하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}