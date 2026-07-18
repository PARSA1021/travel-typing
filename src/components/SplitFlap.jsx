import { useEffect, useRef, useState } from "react";

// 숫자가 바뀔 때마다 옛날 공항/기차역 발착 안내판처럼 위아래로 갈리며
// 전환되는 효과. 바뀐 자리만 애니메이션이 걸리고, 그렇지 않은 자리는
// 조용히 그대로 있는다.
const SWAP_AT_MS = 120;
const CLEAR_AT_MS = 260;

export function SplitFlap({ value, className = "" }) {
  const str = String(value);
  const [shown, setShown] = useState(str);
  const [flipping, setFlipping] = useState({});
  const prevRef = useRef(str);
  const timersRef = useRef([]);

  useEffect(() => {
    if (str === prevRef.current) return undefined;
    const prev = prevRef.current;
    prevRef.current = str;

    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    const maxLen = Math.max(prev.length, str.length);
    const nextFlipping = {};
    for (let i = 0; i < maxLen; i++) {
      if (prev[i] !== str[i]) nextFlipping[i] = true;
    }
    setFlipping(nextFlipping);

    const swapTimer = setTimeout(() => setShown(str), SWAP_AT_MS);
    const clearTimer = setTimeout(() => setFlipping({}), CLEAR_AT_MS);
    timersRef.current = [swapTimer, clearTimer];

    return () => {
      clearTimeout(swapTimer);
      clearTimeout(clearTimer);
    };
  }, [str]);

  const len = Math.max(shown.length, str.length);
  const chars = Array.from({ length: len }, (_, i) => shown[i] ?? str[i] ?? "");

  return (
    <span className={`split-flap ${className}`}>
      {chars.map((char, i) => (
        <span key={i} className={`flap-char ${flipping[i] ? "is-flipping" : ""}`}>
          {char}
        </span>
      ))}
    </span>
  );
}