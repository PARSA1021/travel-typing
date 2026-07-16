// GameScreen이 현재 머무르고 있는 도시의 나라(stop.country)를 CSS 클래스로
// 바꿔서 game-screen-fullscreen 루트에 붙인다. styles.css의
// .game-screen-fullscreen.country-* 규칙이 --country-accent 등의 CSS 변수를
// 정의하고, 하단 타이핑 알약/도착 토스트가 그 변수를 이어받아 색이 바뀐다.
const COUNTRY_ACCENT_CLASS = {
  France: "country-france",
  Switzerland: "country-switzerland",
  Italy: "country-italy",
};

export function getCountryAccentClass(country) {
  return COUNTRY_ACCENT_CLASS[country] || "country-default";
}