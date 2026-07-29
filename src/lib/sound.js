// Web Audio API로 기계식 키보드 타건음(Mechanical Switch Click/Thock),
// 목적지 도착 챠임, 오타 덜컥음, 콤보 마일스톤 사운드를 직접 합성한다.

let audioCtx = null;

function getContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) audioCtx = new AudioContextClass();
  return audioCtx;
}

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

  gain.gain.setValueAtTime(volume, startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

// 기계식 청축/갈축 타건음 (Noise Burst + Resonant Body Pitch)
export function playCorrectSound() {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const startAt = ctx.currentTime;
  
  // Randomize pitch slightly (450Hz ~ 550Hz) so every keystroke sounds unique & organic
  const randomPitch = 480 + Math.random() * 90;
  
  // 1. Switch Click (sine/triangle body)
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(randomPitch, startAt);
  osc.frequency.exponentialRampToValueAtTime(180, startAt + 0.04);
  gain.gain.setValueAtTime(0.18, startAt);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.04);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + 0.045);

  // 2. Snap Noise (high snap)
  const bufferSize = ctx.sampleRate * 0.015; // 15ms noise
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.08, startAt);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.015);
  noise.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(startAt);
}

// 오타 - 둔탁한 덜컥음 (Low Thock)
export function playErrorSound() {
  playTone({ frequency: 120, duration: 0.1, type: "sawtooth", volume: 0.15 });
  playTone({ frequency: 80, duration: 0.14, type: "square", volume: 0.12, delay: 0.02 });
}

// 정류장 도착 - 아름다운 3음 도미솔 챠임
export function playArrivalSound() {
  playTone({ frequency: 523.25, duration: 0.18, type: "sine", volume: 0.15 }); // C5
  playTone({ frequency: 659.25, duration: 0.22, type: "sine", volume: 0.15, delay: 0.07 }); // E5
  playTone({ frequency: 783.99, duration: 0.35, type: "triangle", volume: 0.18, delay: 0.14 }); // G5
}

// 콤보 달성 팡파르 (10/20/30 콤보 등)
export function playComboSound(combo) {
  if (combo % 10 !== 0 || combo === 0) return;
  const baseFreq = Math.min(600 + combo * 10, 1200);
  playTone({ frequency: baseFreq, duration: 0.12, type: "sine", volume: 0.16 });
  playTone({ frequency: baseFreq * 1.25, duration: 0.2, type: "triangle", volume: 0.18, delay: 0.08 });
}

// 출발 슈웅~ 효과음 (Brisk Whoosh / Turbo Departure)
export function playDepartureSound() {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const startAt = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(240, startAt);
  osc.frequency.exponentialRampToValueAtTime(720, startAt + 0.12);

  gain.gain.setValueAtTime(0.12, startAt);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.14);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startAt);
  osc.stop(startAt + 0.15);
}