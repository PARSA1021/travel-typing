import { MapPin } from "lucide-react";

export function ArrivalPopup({ stop, visible }) {
  if (!visible || !stop) return null;

  return (
    <div className="arrival-toast-container">
      <div className="arrival-toast">
        <div className="toast-icon">
          <MapPin size={20} color="#fff" />
        </div>
        <div className="toast-content">
          <span className="toast-subtitle">도착 완료!</span>
          <strong className="toast-title">{stop.name_ko}</strong>
        </div>
      </div>
    </div>
  );
}
