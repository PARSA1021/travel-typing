// 개인 기록(완주 횟수, 최고 정확도/콤보, 업적 판정에 필요한 값들)을
// 브라우저에 저장한다. 서버가 없는 프로젝트라 localStorage로 충분하고,
// 저장에 실패해도(프라이빗 모드 등) 게임 진행 자체에는 영향이 없도록
// 항상 try/catch로 감싼다.
import { GAME_TYPES } from "./gameTypes";

const STORAGE_KEY = "travel-typing:stats:v1";

const DEFAULT_STATS = {
  totalRuns: 0,
  totalStopsVisited: 0,
  bestAccuracy: 0,
  bestSpeedKo: 0,
  bestSpeedEn: 0,
  bestCombo: 0,
  completedRouteIds: [],
  completedGrandTour: false,
  completedFreeRide: false,
  hasPerfectRun: false,
  firstPlayedAt: null,
};

export function loadStats() {
  if (typeof window === "undefined") return DEFAULT_STATS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATS, ...parsed };
  } catch {
    return DEFAULT_STATS;
  }
}

// 홈 화면의 "기록 초기화" 버튼에서 호출한다. 실패해도(프라이빗 모드 등)
// 화면에는 항상 초기 상태를 돌려준다.
export function clearStats() {
  if (typeof window === "undefined") return DEFAULT_STATS;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 저장 실패해도 무시
  }
  return DEFAULT_STATS;
}
// 한 판이 끝날 때(App.jsx의 finishGame) 호출한다. "line"(시간 제한 없는
// 완주 모드)일 때만 코스/그랜드투어를 "완주"로 인정한다 - 타임어택 중간에
// 시간이 끝난 경우까지 완주로 쳐주진 않는다. 자유 주행은 애초에 타임어택
// 전용 모드라, 한 판 끝까지 도달한 것 자체를 완료로 인정한다.
export function recordRun({ completed, accuracy, speed, typingLanguage, maxCombo, routeId, gameType, timerMode }) {
  if (typeof window === "undefined") return DEFAULT_STATS;
  const prev = loadStats();

  const next = {
    ...prev,
    totalRuns: prev.totalRuns + 1,
    totalStopsVisited: prev.totalStopsVisited + Math.max(0, completed),
    bestAccuracy: Math.max(prev.bestAccuracy, accuracy),
    bestCombo: Math.max(prev.bestCombo, maxCombo),
    bestSpeedKo: typingLanguage === "ko" ? Math.max(prev.bestSpeedKo, speed) : prev.bestSpeedKo,
    bestSpeedEn: typingLanguage === "en" ? Math.max(prev.bestSpeedEn, speed) : prev.bestSpeedEn,
    hasPerfectRun: prev.hasPerfectRun || accuracy === 100,
    firstPlayedAt: prev.firstPlayedAt || Date.now(),
  };

  if (gameType === GAME_TYPES.ROUTE && timerMode === "line" && routeId && !prev.completedRouteIds.includes(routeId)) {
    next.completedRouteIds = [...prev.completedRouteIds, routeId];
  }
  if (gameType === GAME_TYPES.GRAND_TOUR && timerMode === "line") {
    next.completedGrandTour = true;
  }
  if (gameType === GAME_TYPES.FREE_RIDE) {
    next.completedFreeRide = true;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 저장 실패해도 무시 - 통계는 부가 기능일 뿐 게임 진행엔 영향 없음
  }
  return next;
}