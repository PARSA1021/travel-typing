import { useEffect, useState, memo } from "react";
import { Stamp } from "lucide-react";

// visible이 false가 되어도 즉시 사라지지 않고, CSS 트랜지션이 끝날 시간(250ms)을
// 벌어준 뒤 언마운트한다. 그동안 "is-leaving" 클래스가 붙어 페이드아웃/스케일아웃
// 같은 퇴장 애니메이션을 CSS에서 자유롭게 정의할 수 있다.
const EXIT_DURATION_MS = 250;

function ArrivalPopupImpl({ stop, visible }) {
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
      {/* 여권 입국 스탬프 느낌 - 정류장 도착마다 "쾅" 찍히는 연출 */}
      <div className="arrival-stamp">
        <Stamp size={14} aria-hidden="true" className="stamp-icon" />
        <span className="stamp-label">ARRIVED</span>
        <strong className="stamp-city">{stop.name_ko}</strong>
      </div>
    </div>
  );
}

export const ArrivalPopup = memo(ArrivalPopupImpl);