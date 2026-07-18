// Web Audio API로 짧은 톤을 직접 합성한다. 정답/오답/도착 정도의 짧은
// 효과음이라 mp3 같은 에셋 파일을 따로 두지 않는 편이 로딩 지연도 없고
// 이 프로젝트 규모에 비해 훨씬 가볍다.

let audioCtx = null;

function getContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) audioCtx = new AudioContextClass();
  return audioCtx;
}

// 브라우저의 자동재생 정책 때문에, 사용자가 페이지와 한 번이라도 직접
// 상호작용(클릭/키 입력)하기 전에는 오디오 컨텍스트가 "suspended" 상태로
// 시작한다. 실제 사용자 제스처(예: "출발하기" 버튼 클릭) 안에서 한 번
// 호출해두면, 그 뒤로는 소리가 안정적으로 재생된다.
export function unlockAudio() {
  const ctx = getContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

function playTone({ frequency, duration = 0.12, type = "sine", volume = 0.16, delay = 0 }) {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const startAt = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startAt);

  // 뚝 끊기지 않고 자연스럽게 사그라들도록 지수적으로 감쇠시킨다.
  gain.gain.setValueAtTime(volume, startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

// 글자를 맞췄을 때 - 짧고 가벼운 클릭음
export function playCorrectSound() {
  playTone({ frequency: 720, duration: 0.06, type: "sine", volume: 0.13 });
}

// 오타 - 낮고 짧은 부저음
export function playErrorSound() {
  playTone({ frequency: 150, duration: 0.13, type: "square", volume: 0.11 });
}

// 정류장 도착 - 두 음을 살짝 겹쳐서 "딩동" 느낌
export function playArrivalSound() {
  playTone({ frequency: 880, duration: 0.15, type: "triangle", volume: 0.15 });
  playTone({ frequency: 1174, duration: 0.22, type: "triangle", volume: 0.13, delay: 0.09 });
}