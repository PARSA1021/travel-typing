// 개인 기록(완주 횟수, 최고 정확도/콤보 등)을 브라우저에 저장한다. 서버가
// 없는 프로젝트라 localStorage로 충분하고, 저장에 실패해도(프라이빗 모드 등)
// 게임 진행 자체에는 영향이 없도록 항상 try/catch로 감싼다.

const STORAGE_KEY = "travel-typing:stats:v1";

const DEFAULT_STATS = {
  totalRuns: 0,
  totalStopsVisited: 0,
  bestAccuracy: 0,
  bestSpeedKo: 0,
  bestSpeedEn: 0,
  bestCombo: 0,
  completedRouteIds: [],
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

// 한 판이 끝날 때(App.jsx의 finishGame) 호출한다.
export function recordRun({ completed, accuracy, speed, typingLanguage, maxCombo, routeId, fullyCompletedRoute }) {
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
  };

  if (fullyCompletedRoute && routeId && !prev.completedRouteIds.includes(routeId)) {
    next.completedRouteIds = [...prev.completedRouteIds, routeId];
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 저장 실패해도 무시 - 통계는 부가 기능일 뿐 게임 진행엔 영향 없음
  }
  return next;
}