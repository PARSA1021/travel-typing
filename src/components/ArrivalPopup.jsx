import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";

// visible이 false가 되어도 즉시 사라지지 않고, CSS 트랜지션이 끝날 시간(250ms)을
// 벌어준 뒤 언마운트한다. 그동안 "is-leaving" 클래스가 붙어 페이드아웃/스케일아웃
// 같은 퇴장 애니메이션을 CSS에서 자유롭게 정의할 수 있다.
const EXIT_DURATION_MS = 250;

export function ArrivalPopup({ stop, visible }) {
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (visible && stop) {
      setMounted(true);
      setLeaving(false);
      return undefined;
    }
    if (mounted) {
      setLeaving(true);
      const timer = setTimeout(() => {
        setMounted(false);
        setLeaving(false);
      }, EXIT_DURATION_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, stop]);

  if (!mounted || !stop) return null;

  return (
    <div
      className={`arrival-toast-container ${leaving ? "is-leaving" : "is-entering"}`}
      role="status"
      aria-live="polite"
    >
      <div className="arrival-toast">
        <div className="toast-icon">
          <MapPin size={20} color="#fff" aria-hidden="true" />
        </div>
        <div className="toast-content">
          <span className="toast-subtitle">도착 완료!</span>
          <strong className="toast-title">{stop.name_ko}</strong>
        </div>
      </div>
    </div>
  );
}