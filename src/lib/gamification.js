// 지역 데이터를 더 늘리는 대신, 이미 쌓이고 있는 기록(완주 횟수, 정확도,
// 콤보 등)을 가지고 "패스포트에 찍히는 스탬프"와 "탑승권 등급"이라는
// 두 가지 게임적 재미 요소를 만든다. 전부 기존 stats에서 파생되는
// 값이라 별도로 저장할 필요가 없다.

export const ACHIEVEMENTS = [
  {
    id: "first_trip",
    label: "첫 발걸음",
    desc: "첫 여행을 완주했어요",
    check: (s) => s.totalRuns >= 1,
  },
  {
    id: "five_trips",
    label: "단골 여행자",
    desc: "5번 완주했어요",
    check: (s) => s.totalRuns >= 5,
  },
  {
    id: "twenty_trips",
    label: "베테랑 여행자",
    desc: "20번 완주했어요",
    check: (s) => s.totalRuns >= 20,
  },
  {
    id: "hundred_stops",
    label: "발자국 100",
    desc: "정류장 100곳을 방문했어요",
    check: (s) => s.totalStopsVisited >= 100,
  },
  {
    id: "perfect_run",
    label: "완벽한 여정",
    desc: "정확도 100%로 완주했어요",
    check: (s) => s.hasPerfectRun,
  },
  {
    id: "combo_25",
    label: "리듬을 타다",
    desc: "25콤보를 달성했어요",
    check: (s) => s.bestCombo >= 25,
  },
  {
    id: "combo_50",
    label: "손끝의 폭풍",
    desc: "50콤보를 달성했어요",
    check: (s) => s.bestCombo >= 50,
  },
  {
    id: "grand_tour",
    label: "그랜드투어",
    desc: "유럽 그랜드투어를 완주했어요",
    check: (s) => s.completedGrandTour,
  },
  {
    id: "free_ride",
    label: "쾌속 질주",
    desc: "자유 주행을 끝까지 마쳤어요",
    check: (s) => s.completedFreeRide,
  },
  {
    id: "speed_demon",
    label: "탑승 마감 임박",
    desc: "한글 200타/분 또는 영문 60WPM을 달성했어요",
    check: (s) => s.bestSpeedKo >= 200 || s.bestSpeedEn >= 60,
  },
  {
    id: "all_routes",
    label: "유럽 정복",
    desc: "모든 코스를 완주했어요",
    // routesCount는 실제 코스 개수를 아는 HomeScreen에서 context로 넘겨준다.
    check: (s, ctx = {}) => Boolean(ctx.routesCount) && s.completedRouteIds.length >= ctx.routesCount,
  },
];

export function getAchievementStatus(stats, context = {}) {
  return ACHIEVEMENTS.map((achievement) => ({
    ...achievement,
    unlocked: achievement.check(stats, context),
  }));
}

// 탑승권 등급 - 누적 완주 횟수를 기준으로 승급한다. 보딩패스 히어로의
// "ECONOMY · TYPING CLASS" 자리에 그대로 꽂아 쓴다.
const TIERS = [
  { code: "FIRST", label: "FIRST CLASS", minRuns: 30 },
  { code: "BUSINESS", label: "BUSINESS", minRuns: 10 },
  { code: "ECONOMY", label: "ECONOMY", minRuns: 0 },
];

export function getTier(stats) {
  return TIERS.find((tier) => stats.totalRuns >= tier.minRuns) ?? TIERS[TIERS.length - 1];
}

// 다음 등급까지 남은 완주 횟수 (이미 최고 등급이면 null)
export function getRunsToNextTier(stats) {
  const currentIndex = TIERS.findIndex((tier) => stats.totalRuns >= tier.minRuns);
  if (currentIndex <= 0) return null;
  return TIERS[currentIndex - 1].minRuns - stats.totalRuns;
}