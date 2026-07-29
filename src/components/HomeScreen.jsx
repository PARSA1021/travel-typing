import { useState } from "react";
import { Globe2, Shuffle, ChevronRight, Map, Star, Award, Settings2, Play, MapPin, Plane, Keyboard, AlignLeft, Plus } from "lucide-react";
import { TYPING_LANGUAGES, TYPING_MODES } from "../lib/typing";
import { useGameStore } from "../store/useGameStore";
import { CustomRouteModal } from "./CustomRouteModal";

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { setDifficulty: setStoreDifficulty, typingTargetMode, setTypingTargetMode } = useGameStore();
  const [difficulty, setDifficulty] = useState("beginner");

  const handleRouteSelect = (routeId) => {
    onGameTypeChange(GAME_TYPES.ROUTE);
    onSelectRoute(routeId);
    setShowSettings(true);
  };

  const handleCreatedRouteSelect = (routeId) => {
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
  const todaysRoute = routes[Math.floor(Date.now() / 86400000) % routes.length];
  const totalStops = routes.reduce((sum, r) => sum + r.stops.length, 0);

  return (
    <div className="home-album">
      <section className="album-hero">
        <div className="hero-badge">✈️ MY TRAVEL TYPING</div>
        <h1 className="album-title">유럽 여행을<br/>타이핑으로 떠나요</h1>
        <p className="album-sub">
          프랑스, 스위스, 이탈리아의 아름다운 여행지를 손끝으로 방문하세요.<br/>
          {routes.length}개 코스 · {totalStops}개 여행지
        </p>
      </section>

      {/* Today's pick */}
      <section className="album-todays-pick">
        <div className="todays-pick-card" onClick={() => handleRouteSelect(todaysRoute?.id)}>
          <div className="pick-left">
            <div className="pick-badge">
              <Star size={14} fill="currentColor" /> 오늘의 추천
            </div>
            <h2>{todaysRoute?.title}</h2>
            <p>{todaysRoute?.country} · {todaysRoute?.stops.length}곳</p>
          </div>
          <div className="pick-right">
            <span className="pick-flag">{todaysRoute?.countryFlag}</span>
            <ChevronRight size={20} />
          </div>
        </div>
      </section>

      {/* Route gallery */}
      <section className="album-gallery-section">
        <div className="gallery-header-row">
          <h3 className="section-title">
            <MapPin size={20} /> 여행 코스
          </h3>
          <button
            type="button"
            className="create-custom-route-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} /> 내 실제 여행 코스 만들기 (위도/경도 입력)
          </button>
        </div>

        <div className="album-gallery">
          {routes.map((route) => (
            <button
              key={route.id}
              type="button"
              className={`album-card ${selectedRouteId === route.id ? "is-selected" : ""} ${route.isCustom ? "is-custom-route" : ""}`}
              onClick={() => handleRouteSelect(route.id)}
            >
              <div
                className="album-card-image"
                style={{ background: COUNTRY_COLORS[route.country] || COUNTRY_COLORS["Italy"] }}
              >
                <span className="album-card-flag">{route.countryFlag}</span>
                <span className="album-card-stops">{route.stops.length} Places</span>
                {route.isCustom && <span className="custom-tag">MY TRIP</span>}
              </div>
              <div className="album-card-content">
                <h4 className="album-card-title">{route.title}</h4>
                <p className="album-card-meta">{route.country}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <CustomRouteModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSelectCreatedRoute={handleCreatedRouteSelect}
      />

      {/* Special modes */}
      <section className="album-special-modes">
        <h3 className="section-title">
          <Plane size={20} /> 스페셜 모드
        </h3>
        <div className="special-modes-grid">
          <button
            className={`special-mode-card ${gameType === GAME_TYPES.GRAND_TOUR ? "is-active" : ""}`}
            onClick={() => {
              onGameTypeChange(GAME_TYPES.GRAND_TOUR);
              setShowSettings(true);
            }}
          >
            <div className="sm-icon grand-tour"><Map size={24} /></div>
            <div className="sm-info">
              <strong>유럽 그랜드투어</strong>
              <span>모든 코스를 한 번에 정복 · {totalStops}곳</span>
            </div>
          </button>
          <button
            className={`special-mode-card ${gameType === GAME_TYPES.FREE_RIDE ? "is-active" : ""}`}
            onClick={() => {
              onGameTypeChange(GAME_TYPES.FREE_RIDE);
              onTimerModeChange("timed");
              setShowSettings(true);
            }}
          >
            <div className="sm-icon free-ride"><Shuffle size={24} /></div>
            <div className="sm-info">
              <strong>자유 주행 (30초)</strong>
              <span>무작위 타임어택</span>
            </div>
          </button>
        </div>
      </section>

      {/* Bottom Sheet (settings) */}
      <div className={`album-bottom-sheet ${showSettings ? "is-open" : ""}`}>
        <div className="sheet-backdrop" onClick={() => setShowSettings(false)}></div>
        <div className="sheet-content">
          <div className="sheet-header">
            <div className="sheet-handle"></div>
            <h3>여행 준비하기</h3>
          </div>

          <div className="sheet-body">
            <div className="setting-group">
              <label><Award size={16} /> 난이도 선택</label>
              <div className="difficulty-options">
                <button
                  className={`diff-btn ${difficulty === "beginner" ? "active" : ""}`}
                  onClick={() => handleDifficultySelect("beginner")}
                >
                  <span className="diff-icon">🌱</span>
                  <strong>초급</strong>
                  <small>한글 지명</small>
                </button>
                <button
                  className={`diff-btn ${difficulty === "intermediate" ? "active" : ""}`}
                  onClick={() => handleDifficultySelect("intermediate")}
                >
                  <span className="diff-icon">🧭</span>
                  <strong>중급</strong>
                  <small>한글 + 영문 힌트</small>
                </button>
                <button
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
              <label><AlignLeft size={16} /> 타자 콘텐츠 모드</label>
              <div className="toggle-group">
                <button
                  className={`toggle-btn ${typingTargetMode === TYPING_MODES.WORD ? "active" : ""}`}
                  onClick={() => setTypingTargetMode(TYPING_MODES.WORD)}
                >
                  📍 여행지 명칭 (단어 타자)
                </button>
                <button
                  className={`toggle-btn ${typingTargetMode === TYPING_MODES.SENTENCE ? "active" : ""}`}
                  onClick={() => setTypingTargetMode(TYPING_MODES.SENTENCE)}
                >
                  📖 여행 이야기 (감성 문장 타자)
                </button>
              </div>
            </div>

            <div className="setting-group">
              <label><Settings2 size={16} /> 게임 방식</label>
              <div className="toggle-group">
                <button
                  className={`toggle-btn ${timerMode === "line" ? "active" : ""}`}
                  onClick={() => onTimerModeChange("line")}
                >
                  코스 완주
                </button>
                <button
                  className={`toggle-btn ${timerMode === "timed" ? "active" : ""}`}
                  onClick={() => onTimerModeChange("timed")}
                >
                  30초 타임어택
                </button>
              </div>
            </div>
          </div>

          <div className="sheet-footer">
            <button className="start-journey-btn" disabled={!canStart} onClick={onStart}>
              <Play size={18} fill="currentColor" /> 출발하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}