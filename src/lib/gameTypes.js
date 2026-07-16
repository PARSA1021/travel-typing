// HomeScreen.jsx와 useGameStore.js가 서로를 import하는 순환 참조를 끊기 위해
// GAME_TYPES를 별도 모듈로 분리했다. 두 파일 모두 여기서 가져다 쓴다.
export const GAME_TYPES = {
  ROUTE: "route",
  GRAND_TOUR: "grand-tour",
  FREE_RIDE: "free-ride",
};