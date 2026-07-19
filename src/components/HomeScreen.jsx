import { useEffect, useMemo, useState } from "react";
import {
  Shuffle, ChevronRight, Map, Star, Award, Settings2, Play, MapPin, Plane,
  Footprints, CheckCircle2, Flame, Lock, Stamp, User, Luggage, Trash2,
} from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import { GAME_TYPES } from "../lib/gameTypes";
import { loadStats, clearStats } from "../lib/stats";
import { getTier, getRunsToNextTier, getAchievementStatus } from "../lib/gamification";
import { SplitFlap } from "./SplitFlap";

// 하위 호환: 기존에 App.jsx 등에서 `import { GAME_TYPES } from "./components/HomeScreen"`로
// 가져다 쓰던 코드가 계속 동작하도록 재수출한다. 실제 정의는 lib/gameTypes.js에 있다
// (여기 두면 useGameStore.js ↔ HomeScreen.jsx 순환 참조가 생김).
export { GAME_TYPES };

const COUNTRY_COLORS = {
  France: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
  "France · Switzerland": "linear-gradient(135deg, #3B82F6 0%, #10B981 100%)",
  Italy: "linear-gradient(135deg, #EF4444 0%, #F97316 100%)",
  Switzerland: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
};

const DAY_MS = 86400000;

// 정류장별 rating의 평균을 코스 평점으로 보여준다.
function getRouteRating(route) {
  if (!route.stops.length) return null;
  const sum = route.stops.reduce((total, stop) => total + (stop.rating || 0), 0);
  return Math.round((sum / route.stops.length) * 10) / 10;
}

function formatIssueDate(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
}

// 실제 MRZ(여권 하단 기계판독영역) 규격을 그대로 따르진 않지만, 같은 느낌의
// 두 줄짜리 코드를 개인 기록으로부터 만들어서 "진짜 여권 같은" 디테일을 더한다.
function buildMrzLines(stats, tier) {
  const pad = (str, len) => (str + "<".repeat(len)).slice(0, len);
  const passportNo = `T${String(stats.totalRuns).padStart(6, "0")}`;
  const line1 = pad(`P<EURTYPING<<TRAVELER<<${tier.code}`, 38);
  const line2 = pad(
    `${passportNo}<8EUR<<<<<<<<<<<<<${String(stats.totalStopsVisited).padStart(3, "0")}<${stats.bestCombo}`,
    38,
  );
  return [line1, line2];
}

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
  const [page, setPage] = useState("routes"); // "routes" | "stamps"
  const {
    difficulty: storedDifficulty,
    setDifficulty: setStoreDifficulty,
  } = useGameStore();

  // 스토어에 이미 저장된 난이도가 있으면 그걸로 초기화한다.
  const [difficulty, setDifficulty] = useState(storedDifficulty || "beginner");

  // 홈 화면은 게임이 끝날 때마다 다시 마운트되므로, 초기값을 이 시점에
  // 읽어오는 것만으로 매번 최신 기록이 반영된다. 기록을 초기화할 때는
  // setMyStats로 즉시 화면에도 반영한다.
  const [myStats, setMyStats] = useState(() => loadStats());
  const tier = useMemo(() => getTier(myStats), [myStats]);
  const runsToNextTier = useMemo(() => getRunsToNextTier(myStats), [myStats]);
  const achievements = useMemo(
    () => getAchievementStatus(myStats, { routesCount: routes.length }),
    [myStats, routes.length],
  );
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const mrzLines = useMemo(() => buildMrzLines(myStats, tier), [myStats, tier]);

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
  };

  const handleResetStats = () => {
    if (typeof window !== "undefined" && !window.confirm("정말 모든 기록을 초기화할까요? 완주 횟수, 최고 기록, 스탬프가 전부 사라지고 되돌릴 수 없어요.")) {
      return;
    }
    setMyStats(clearStats());
  };

  const canStart = gameType !== GAME_TYPES.ROUTE || Boolean(selectedRouteId);

  return (
    <div className="home-album">
      {/* ---------- 여권 바이오 페이지 ---------- */}
      <section className="passport-bio">
        <div className="passport-bio-header">
          <span className="passport-bio-kicker">EUROPEAN TYPING UNION</span>
          <span className="passport-bio-title">TYPING PASSPORT</span>
        </div>

        <div className="passport-bio-body">
          <div className="passport-photo" aria-hidden="true">
            <User size={40} />
          </div>

          <div className="passport-fields">
            <div className="pp-field pp-field-wide">
              <span className="pp-label">SURNAME / GIVEN NAMES</span>
              <span className="pp-value">TRAVELER, 유럽 여행자</span>
            </div>
            <div className="pp-field">
              <span className="pp-label">NATIONALITY</span>
              <span className="pp-value">EUROPE</span>
            </div>
            <div className="pp-field">
              <span className="pp-label">TYPE / CLASS</span>
              <span className="pp-value pp-value-accent">{tier.label}</span>
            </div>
            <div className="pp-field">
              <span className="pp-label">PASSPORT NO.</span>
              <span className="pp-value">T{String(myStats.totalRuns).padStart(6, "0")}</span>
            </div>
            <div className="pp-field">
              <span className="pp-label">ISSUED</span>
              <span className="pp-value">{formatIssueDate(myStats.firstPlayedAt)}</span>
            </div>
          </div>
        </div>

        <p className="passport-bio-note">
          유럽 여행지를 손끝으로 방문하세요.
          {runsToNextTier ? ` ${runsToNextTier}번 더 완주하면 ${tier.code === "ECONOMY" ? "BUSINESS" : "FIRST CLASS"}로 승급해요.` : " 이미 최고 등급이에요 — 여권이 꽉 찼네요 ✈️"}
        </p>

        <div className="passport-mrz" aria-hidden="true">
          <span>{mrzLines[0]}</span>
          <span>{mrzLines[1]}</span>
        </div>
      </section>

      {/* ---------- 페이지 인덱스 탭 ---------- */}
      <div className="passport-tabs" role="tablist" aria-label="여권 페이지">
        <button
          type="button"
          role="tab"
          aria-selected={page === "routes"}
          className={`passport-tab ${page === "routes" ? "is-active" : ""}`}
          onClick={() => setPage("routes")}
        >
          <Luggage size={15} aria-hidden="true" /> 여행 계획
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={page === "stamps"}
          className={`passport-tab ${page === "stamps" ? "is-active" : ""}`}
          onClick={() => setPage("stamps")}
        >
          <Stamp size={15} aria-hidden="true" /> 스탬프
          {unlockedCount > 0 ? <span className="passport-tab-badge">{unlockedCount}</span> : null}
        </button>
      </div>

      <div className="passport-page">
        {page === "routes" ? (
          <>
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
                    <p>
                      {todaysRoute.country} · {todaysRoute.stops.length}곳
                      {getRouteRating(todaysRoute) ? ` · ⭐ ${getRouteRating(todaysRoute)}` : ""}
                    </p>
                    {myStats.completedRouteIds.includes(todaysRoute.id) ? (
                      <span className="route-completed-tag">
                        <CheckCircle2 size={13} aria-hidden="true" /> 완주 완료
                      </span>
                    ) : null}
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
                {routes.map((route) => {
                  const rating = getRouteRating(route);
                  const firstStop = route.stops[0];
                  const lastStop = route.stops[route.stops.length - 1];
                  const isCompleted = myStats.completedRouteIds.includes(route.id);
                  return (
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
                        {rating ? (
                          <span className="album-card-rating">
                            <Star size={11} fill="currentColor" aria-hidden="true" /> {rating}
                          </span>
                        ) : null}
                        {isCompleted ? (
                          <span className="album-card-completed">
                            <CheckCircle2 size={13} aria-hidden="true" />
                          </span>
                        ) : null}
                        <span className="album-card-flag">{route.countryFlag}</span>
                        <span className="album-card-stops">{route.stops.length} Places</span>
                      </div>
                      <div className="album-card-content">
                        <h4 className="album-card-title">{route.title}</h4>
                        <p className="album-card-meta">{route.country}</p>
                        {firstStop && lastStop && firstStop !== lastStop ? (
                          <p className="album-card-route">{firstStop.name_ko} → {lastStop.name_ko}</p>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
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
          </>
        ) : (
          <>
            {/* My stats */}
            {myStats.totalRuns > 0 ? (
              <section className="album-my-stats">
                <h3 className="section-title">
                  <Footprints size={20} aria-hidden="true" /> 나의 기록
                </h3>
                <div className="my-stats-grid">
                  <div className="my-stat-card">
                    <span className="my-stat-value"><SplitFlap value={myStats.totalRuns} /></span>
                    <span className="my-stat-label">완주한 여행</span>
                  </div>
                  <div className="my-stat-card">
                    <span className="my-stat-value"><SplitFlap value={myStats.totalStopsVisited} /></span>
                    <span className="my-stat-label">방문한 정류장</span>
                  </div>
                  <div className="my-stat-card">
                    <span className="my-stat-value"><SplitFlap value={myStats.bestAccuracy} />%</span>
                    <span className="my-stat-label">최고 정확도</span>
                  </div>
                  <div className="my-stat-card">
                    <span className="my-stat-value"><Flame size={16} aria-hidden="true" /><SplitFlap value={myStats.bestCombo} /></span>
                    <span className="my-stat-label">최고 콤보</span>
                  </div>
                </div>
              </section>
            ) : (
              <section className="album-my-stats is-empty">
                <p>첫 여행을 완주하면 여기에 나만의 기록이 쌓여요 🧳</p>
              </section>
            )}

            {/* Passport stamps (achievements) */}
            <section className="album-passport">
              <h3 className="section-title">
                <Stamp size={20} aria-hidden="true" /> 패스포트 스탬프
                <span className="passport-count">{unlockedCount} / {achievements.length}</span>
              </h3>
              <div className="passport-grid">
                {achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className={`passport-stamp ${achievement.unlocked ? "is-unlocked" : "is-locked"}`}
                    title={achievement.unlocked ? achievement.desc : `??? · ${achievement.desc}`}
                  >
                    {achievement.unlocked ? (
                      <Stamp size={18} aria-hidden="true" />
                    ) : (
                      <Lock size={14} aria-hidden="true" />
                    )}
                    <span className="passport-stamp-label">
                      {achievement.unlocked ? achievement.label : "???"}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {myStats.totalRuns > 0 ? (
              <button type="button" className="reset-stats-link" onClick={handleResetStats}>
                <Trash2 size={13} aria-hidden="true" /> 기록 초기화
              </button>
            ) : null}
          </>
        )}
      </div>

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