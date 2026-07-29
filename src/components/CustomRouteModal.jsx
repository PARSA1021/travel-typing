import { useState } from "react";
import { X, Plus, Trash2, MapPin, Compass, Check, Sparkles } from "lucide-react";
import { saveCustomRouteToStorage } from "../hooks/useTravelData";

const PRESET_PLACES = [
  { name_ko: "에펠탑", name_en: "Eiffel Tower", city: "Paris", country: "France", coordinates: [2.2945, 48.8584], description: "파리의 영원한 낭만과 상징" },
  { name_ko: "루브르 박물관", name_en: "Louvre Museum", city: "Paris", country: "France", coordinates: [2.3376, 48.8606], description: "인류의 예술과 역사를 품은 박물관" },
  { name_ko: "사크레쾨르 대성당", name_en: "Sacré-Cœur", city: "Paris", country: "France", coordinates: [2.3428, 48.8867], description: "몽마르트르 언덕 위의 순백 바실리카" },
  { name_ko: "인터라켄 오스트", name_en: "Interlaken Ost", city: "Interlaken", country: "Switzerland", coordinates: [7.87, 46.693], description: "융프라우 알프스의 설레는 관문" },
  { name_ko: "융프라우 산", name_en: "Jungfrau", city: "Jungfrau", country: "Switzerland", coordinates: [7.9629, 46.5366], description: "알프스의 장엄한 만년설과 영봉" },
  { name_ko: "루체른 카펠교", name_en: "Chapel Bridge", city: "Lucerne", country: "Switzerland", coordinates: [8.3068, 47.0505], description: "루체른의 역사를 간직한 목조 다리" },
  { name_ko: "밀라노 대성당", name_en: "Milan Cathedral", city: "Milan", country: "Italy", coordinates: [9.19, 45.4642], description: "하얀 대리석 첨탑의 고딕 걸작" },
  { name_ko: "피렌체 대성당", name_en: "Florence Cathedral", city: "Florence", country: "Italy", coordinates: [11.2559, 43.7731], description: "브루넬레스키의 붉은 돔 성전" },
  { name_ko: "콜로세움", name_en: "Colosseum", city: "Rome", country: "Italy", coordinates: [12.4922, 41.8902], description: "고대 로마 제국의 장엄한 원형 경기장" },
  { name_ko: "트레비 분수", name_en: "Trevi Fountain", city: "Rome", country: "Italy", coordinates: [12.4833, 41.9009], description: "바로크 조각의 결정체와 소원의 분수" },
];

export function CustomRouteModal({ isOpen, onClose, onSelectCreatedRoute }) {
  const [routeTitle, setRouteTitle] = useState("");
  const [countryFlag, setCountryFlag] = useState("✈️");
  const [stops, setStops] = useState([
    {
      id: Date.now(),
      name_ko: "파리 에펠탑",
      name_en: "Eiffel Tower",
      city: "Paris",
      country: "France",
      coordinates: [2.2945, 48.8584],
      description: "내가 다녀온 파리의 첫 순간",
    },
  ]);

  if (!isOpen) return null;

  const handleAddPreset = (preset) => {
    setStops((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        ...preset,
      },
    ]);
  };

  const handleAddEmptyStop = () => {
    setStops((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        name_ko: "",
        name_en: "",
        city: "Custom",
        country: "France",
        coordinates: [2.3522, 48.8566],
        description: "",
      },
    ]);
  };

  const handleUpdateStop = (id, field, value) => {
    setStops((prev) =>
      prev.map((stop) => {
        if (stop.id !== id) return stop;
        if (field === "lat") {
          const lat = parseFloat(value) || 0;
          return { ...stop, coordinates: [stop.coordinates[0], lat] };
        }
        if (field === "lng") {
          const lng = parseFloat(value) || 0;
          return { ...stop, coordinates: [lng, stop.coordinates[1]] };
        }
        return { ...stop, [field]: value };
      })
    );
  };

  const handleRemoveStop = (id) => {
    setStops((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!routeTitle.trim() || !stops.length) return;

    const validStops = stops.filter((s) => s.name_ko.trim());
    if (!validStops.length) return;

    const routeId = `custom-route-${Date.now()}`;
    const newRoute = {
      id: routeId,
      title: routeTitle.trim(),
      title_en: "My Custom Trip",
      country: validStops[0]?.country || "Europe",
      countryFlag: countryFlag || "✈️",
      isCustom: true,
      stops: validStops.map((s, idx) => ({
        ...s,
        id: idx + 1,
        coordinates: [
          parseFloat(s.coordinates[0]) || 2.3522,
          parseFloat(s.coordinates[1]) || 48.8566,
        ],
      })),
    };

    saveCustomRouteToStorage(newRoute);
    if (onSelectCreatedRoute) onSelectCreatedRoute(routeId);
    onClose();
  };

  return (
    <div className="custom-route-modal-backdrop" onClick={onClose}>
      <div className="custom-route-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>나의 실제 여행 코스 만들기 🗺️</h3>
            <p>다녀오신 여행지의 이름과 실제 GPS 위도/경도를 등록하세요!</p>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-row">
            <div className="form-group flex-2">
              <label>코스 제목</label>
              <input
                type="text"
                placeholder="예: 2024 서유럽 배낭여행 기록"
                value={routeTitle}
                onChange={(e) => setRouteTitle(e.target.value)}
                required
              />
            </div>
            <div className="form-group flex-1">
              <label>아이콘/깃발</label>
              <input
                type="text"
                placeholder="🇫🇷🇨🇭🇮🇹"
                value={countryFlag}
                onChange={(e) => setCountryFlag(e.target.value)}
              />
            </div>
          </div>

          {/* Preset Chips */}
          <div className="preset-chips-section">
            <label><Sparkles size={14} /> 인기 유럽 명소 빠르게 추가하기</label>
            <div className="chips-grid">
              {PRESET_PLACES.map((preset) => (
                <button
                  key={preset.name_ko}
                  type="button"
                  className="preset-chip"
                  onClick={() => handleAddPreset(preset)}
                >
                  <Plus size={12} /> {preset.name_ko} ({preset.city})
                </button>
              ))}
            </div>
          </div>

          {/* Stops List */}
          <div className="stops-builder-section">
            <div className="builder-header">
              <label><MapPin size={16} /> 여행지 목록 ({stops.length}곳)</label>
              <button type="button" className="add-stop-btn" onClick={handleAddEmptyStop}>
                <Plus size={14} /> 직접 입력 추가
              </button>
            </div>

            <div className="stops-list">
              {stops.map((stop, index) => (
                <div key={stop.id} className="stop-editor-card">
                  <div className="stop-num">{index + 1}</div>
                  <div className="stop-fields">
                    <div className="field-row">
                      <input
                        type="text"
                        placeholder="한글 이름 (예: 에펠탑)"
                        value={stop.name_ko}
                        onChange={(e) => handleUpdateStop(stop.id, "name_ko", e.target.value)}
                        required
                      />
                      <input
                        type="text"
                        placeholder="영문 이름 (예: Eiffel Tower)"
                        value={stop.name_en}
                        onChange={(e) => handleUpdateStop(stop.id, "name_en", e.target.value)}
                      />
                    </div>
                    <div className="field-row">
                      <input
                        type="text"
                        placeholder="도시 (예: Paris)"
                        value={stop.city}
                        onChange={(e) => handleUpdateStop(stop.id, "city", e.target.value)}
                      />
                      <div className="gps-input-group">
                        <Compass size={14} className="gps-icon" />
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="위도(Lat) 예: 48.8584"
                          value={stop.coordinates[1]}
                          onChange={(e) => handleUpdateStop(stop.id, "lat", e.target.value)}
                        />
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="경도(Lng) 예: 2.2945"
                          value={stop.coordinates[0]}
                          onChange={(e) => handleUpdateStop(stop.id, "lng", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="remove-stop-btn"
                    onClick={() => handleRemoveStop(stop.id)}
                    disabled={stops.length <= 1}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="secondary-button" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="start-button" disabled={!routeTitle.trim() || !stops.length}>
              <Check size={16} /> 내 코스 저장하고 시작하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
