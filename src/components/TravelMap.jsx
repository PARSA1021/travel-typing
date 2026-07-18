import React, { useEffect, useRef, useState, useMemo } from "react";
import { getStopsViewBox, pointOnArc, segmentPath, flowBow, TRAVEL_MODES } from "../lib/geo";

const TRAVEL_DURATION_MS = 420;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

// Smoothly eases the camera from one viewBox to the next instead of snapping.
// When the user prefers reduced motion, the camera jumps straight to target.
function useSmoothViewBox(target, reduced) {
  const [box, setBox] = useState(target);
  const boxRef = useRef(target);
  const frameRef = useRef(null);

  useEffect(() => {
    boxRef.current = box;
  });

  useEffect(() => {
    if (reduced) {
      cancelAnimationFrame(frameRef.current);
      boxRef.current = target;
      setBox(target);
      return undefined;
    }
    cancelAnimationFrame(frameRef.current);
    const step = () => {
      const current = boxRef.current;
      const next = current.map((v, i) => v + (target[i] - v) * 0.12);
      const settled = next.every((v, i) => Math.abs(v - target[i]) < 0.4);
      const finalBox = settled ? target : next;
      boxRef.current = finalBox;
      setBox(finalBox);
      if (!settled) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, ...target]);

  return box;
}

// 메트로타이핑 스타일 이동: 타이핑 진행률(글자 수)과 버스/비행기 위치를
// 완전히 분리한다. 타이핑하는 동안엔 버스가 현재 정류장에 가만히 서 있다가,
// 정류장 이름을 다 쳐서 stopIndex가 실제로 넘어가는 그 순간에만 이전
// 정류장 -> 새 정류장으로 한 번에 이동 애니메이션이 재생된다.
//
// (예전엔 타이핑 중 글자 수 비율(journeyProgress)에 버스 위치를 실시간으로
// 묶어뒀는데, 한글 조합 중 "선반영했다가 되돌리는" 과정에서 진행률이
// 순간적으로 오르락내리락하면 버스도 그대로 앞으로 갔다 뒤로 갔다 하는
// 것처럼 보이는 문제가 있었다. 타이핑 진행 상황과 지도 이동을 아예 분리해서
// 이 문제 자체가 발생할 수 없게 만들었다.)
function useVehicleTravel(stopIndex, reduced) {
  const [t, setT] = useState(1); // 1 = 도착해서 정차 중, 0 = 막 출발
  const prevIndexRef = useRef(stopIndex);
  const frameRef = useRef(null);

  useEffect(() => {
    const prevIndex = prevIndexRef.current;
    prevIndexRef.current = stopIndex;

    // 최초 마운트거나 정류장이 실제로 안 바뀐 경우엔 애니메이션 없이 정차 상태 유지
    if (prevIndex === stopIndex) return undefined;

    if (reduced) {
      setT(1);
      return undefined;
    }

    setT(0);
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / TRAVEL_DURATION_MS);
      const eased = 1 - (1 - progress) ** 3; // ease-out
      setT(eased);
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [stopIndex, reduced]);

  return t;
}

// Simple label collision avoidance: shift labels that overlap
function resolveLabels(stops) {
  const labels = stops.map((stop) => ({
    x: stop.point[0],
    y: stop.point[1] - 18,
    anchor: "middle",
    city: stop.city,
  }));

  // Greedy pass: for each pair, push apart if too close
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const dx = labels[j].x - labels[i].x;
      const dy = labels[j].y - labels[i].y;
      if (Math.abs(dx) < 60 && Math.abs(dy) < 14) {
        // push below
        labels[j].y = labels[i].y + 28;
      }
    }
  }
  return labels;
}

const MapBackground = React.memo(function MapBackground({ countries, stops }) {
  return (
    <>
      {/* Sea */}
      <rect x="-2000" y="-2000" width="5000" height="5000" fill="url(#mapSea)" />

      {/* Grid */}
      <g className="map-graticule">
        {Array.from({ length: 14 }).map((_, i) => (
          <line key={`v-${i}`} x1={i * 80 - 80} y1="-2000" x2={i * 80 - 80} y2="2000" />
        ))}
        {Array.from({ length: 14 }).map((_, i) => (
          <line key={`h-${i}`} x1="-2000" y1={i * 80 - 80} x2="2000" y2={i * 80 - 80} />
        ))}
      </g>

      {/* Land */}
      <g className="map-countries" filter="url(#landShadow)">
        {countries.map((c) => (
          <path key={c.id} d={c.path} />
        ))}
      </g>

      {/* Full itinerary (ghosted) */}
      {stops.slice(1).map((stop, index) => {
        const from = stops[index];
        const { d } = segmentPath(from, stop, stop.mode, index);
        return (
          <path
            key={`route-${stop.id}`}
            className={`route-line ${stop.mode === TRAVEL_MODES.PLANE ? "is-flight" : "is-bus"}`}
            d={d}
          />
        );
      })}
    </>
  );
});

function TravelMapImpl({ countries, stops, stopIndex, shake, arrivalStop }) {
  const reducedMotion = usePrefersReducedMotion();
  const nextIndex = stopIndex + 1 < stops.length ? stopIndex + 1 : null;
  const current = stops[stopIndex];
  const next = nextIndex === null ? null : stops[nextIndex];
  const prevStop = stopIndex > 0 ? stops[stopIndex - 1] : null;

  const travelT = useVehicleTravel(stopIndex, reducedMotion);
  const isTraveling = Boolean(prevStop) && travelT < 1;

  // 이동 중일 땐 "출발지 -> 도착지" 두 정류장이 함께 보이도록, 정차 중일 땐
  // "현재 -> 다음" 두 정류장이 보이도록 카메라를 맞춘다 (다음 타이핑
  // 목적지를 미리 보여주면서도, 이동하는 순간엔 버스를 따라가는 느낌을 준다).
  const framingStops = isTraveling ? [prevStop, current] : [current, next];
  const targetBox = getStopsViewBox(framingStops.filter(Boolean), 90, 260);
  const viewBox = useSmoothViewBox(targetBox, reducedMotion).join(" ");

  const isFlight = isTraveling
    ? current.mode === TRAVEL_MODES.PLANE
    : next?.mode === TRAVEL_MODES.PLANE;

  const bow = isTraveling ? flowBow(current.mode, stopIndex - 1) : 0;
  const vehiclePoint = isTraveling ? pointOnArc(prevStop.point, current.point, travelT, bow) : current.point;

  // 정차 중엔 마지막으로 이동하던 방향을 그대로 유지한다 (매번 0도로
  // 리셋되면 정차할 때마다 기체가 홱 돌아가 보인다).
  const lastAngleRef = useRef(0);
  if (isTraveling) {
    const lookahead = travelT > 0.98
      ? pointOnArc(prevStop.point, current.point, Math.max(travelT - 0.02, 0), bow)
      : pointOnArc(prevStop.point, current.point, Math.min(travelT + 0.02, 1), bow);
    lastAngleRef.current = travelT > 0.98
      ? (Math.atan2(vehiclePoint[1] - lookahead[1], vehiclePoint[0] - lookahead[0]) * 180) / Math.PI
      : (Math.atan2(lookahead[1] - vehiclePoint[1], lookahead[0] - vehiclePoint[0]) * 180) / Math.PI;
  }
  const vehicleAngle = lastAngleRef.current;

  const labels = useMemo(() => resolveLabels(stops), [stops]);

  return (
    <svg className="travel-map" viewBox={viewBox} aria-hidden="true" style={{ userSelect: "none" }}>
      <defs>
        <radialGradient id="mapSea" cx="50%" cy="35%" r="75%">
          <stop offset="0%" stopColor="var(--map-sea-near)" />
          <stop offset="100%" stopColor="var(--map-sea-far)" />
        </radialGradient>
        <filter id="mapGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="landShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000000" floodOpacity="0.08" />
        </filter>
        <filter id="vehicleShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.2" />
        </filter>
        <filter id="stopShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.15" />
        </filter>
      </defs>

      <MapBackground countries={countries} stops={stops} />

      {/* Travelled segments (green/blue glow) */}
      {stops.slice(1, stopIndex + 1).map((stop, index) => {
        const from = stops[index];
        const { d } = segmentPath(from, stop, stop.mode, index);
        return (
          <path
            key={`done-${stop.id}`}
            className={`route-line is-done ${stop.mode === TRAVEL_MODES.PLANE ? "is-flight" : "is-bus"}`}
            d={d}
            filter="url(#mapGlow)"
          />
        );
      })}

      {/* Active segment (다음으로 탈 구간을 은은하게 미리 강조) */}
      {!isTraveling && next ? (
        <path
          className={`route-line is-active ${isFlight ? "is-flight" : "is-bus"}`}
          d={segmentPath(current, next, next.mode, stopIndex).d}
        />
      ) : null}

      {/* Stop markers */}
      {stops.map((stop, index) => {
        const state =
          index < stopIndex ? "is-visited" : index === stopIndex ? "is-current" : index === nextIndex ? "is-next" : "";
        const label = labels[index];
        return (
          <g key={stop.id} className={`map-stop ${state}`} transform={`translate(${stop.point[0]},${stop.point[1]})`}>
            {/* Halo for current stop (도착 순간엔 조금 더 크고 진하게 펄스) */}
            {state === "is-current" ? (
              <circle r="18" className={`stop-halo ${arrivalStop ? "is-arrived" : ""}`} />
            ) : null}

            {/* Stop marker */}
            {index < stopIndex ? (
              <g filter="url(#stopShadow)">
                <circle r="8" fill="#10B981" />
                <path d="M-3 0 L-1 3 L4 -2" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            ) : (
              <g filter="url(#stopShadow)">
                <circle r={state === "is-current" || state === "is-next" ? 10 : 7} className="stop-dot" />
                {(state === "is-current" || state === "is-next") && (
                  <circle r="4" fill={state === "is-current" ? "#10B981" : "#3B82F6"} />
                )}
              </g>
            )}

            {/* Label */}
            <text
              className="stop-label"
              x={label.x - stop.point[0]}
              y={label.y - stop.point[1]}
              textAnchor={label.anchor}
            >
              {stop.city}
            </text>
          </g>
        );
      })}

      {/* Vehicle */}
      <g
        className={`vehicle-wrapper ${shake ? "is-error" : ""}`}
        transform={`translate(${vehiclePoint[0]},${vehiclePoint[1]}) rotate(${vehicleAngle})`}
        style={{ transition: reducedMotion ? "none" : "transform 0.1s linear" }}
        filter="url(#vehicleShadow)"
      >
        <g className={`map-vehicle ${isFlight ? "is-flight" : "is-bus"}`}>
          {isFlight ? <PlaneIcon progress={travelT} moving={isTraveling} reduced={reducedMotion} /> : <BusIcon progress={travelT} moving={isTraveling} reduced={reducedMotion} />}
        </g>
      </g>
    </svg>
  );
}

function Wheel({ x }) {
  return (
    <>
      <circle cx={x} cy="0" r="3" fill="#1F2937" />
      <circle cx={x} cy="0" r="1.5" fill="#6B7280" />
      <line x1={x} y1="-2" x2={x} y2="2" stroke="#D1D5DB" strokeWidth="0.8" />
      <line x1={x - 2} y1="0" x2={x + 2} y2="0" stroke="#D1D5DB" strokeWidth="0.8" />
    </>
  );
}

function BusIcon({ progress, moving, reduced }) {
  // 이동 중일 때만 바퀴가 구른다 - 정차 중엔 멈춰 있는 게 자연스럽다.
  const wheelRot = reduced || !moving ? 0 : progress * 360 * 6;
  return (
    <g className="vehicle-icon bus-icon" transform="scale(0.65)">
      {/* Shadow oval */}
      <ellipse cx="0" cy="2" rx="14" ry="6" fill="rgba(0,0,0,0.08)" />
      {/* Bus body */}
      <rect x="-14" y="-8" width="28" height="16" rx="5" fill="#10B981" />
      {/* Roof */}
      <rect x="-12" y="-9" width="24" height="3" rx="1.5" fill="#0D9668" />
      {/* Windows */}
      <rect x="-10" y="-6" width="5" height="5" rx="1" fill="rgba(255,255,255,0.85)" />
      <rect x="-3" y="-6" width="5" height="5" rx="1" fill="rgba(255,255,255,0.85)" />
      <rect x="4" y="-6" width="5" height="5" rx="1" fill="rgba(255,255,255,0.85)" />
      {/* Windshield */}
      <rect x="10" y="-6" width="4" height="12" rx="2" fill="rgba(255,255,255,0.7)" />

      {/* Wheels */}
      <g transform={`translate(-8, 9) rotate(${wheelRot})`}>
        <Wheel x={0} />
      </g>
      <g transform={`translate(6, 9) rotate(${wheelRot})`}>
        <Wheel x={0} />
      </g>

      {/* Front light */}
      <circle cx="14" cy="-4" r="1.5" fill="#FBBF24" />
      <circle cx="14" cy="4" r="1.5" fill="#FBBF24" />
      {/* Rear light */}
      <circle cx="-14" cy="-4" r="1" fill="#EF4444" />
      <circle cx="-14" cy="4" r="1" fill="#EF4444" />
    </g>
  );
}

function PlaneIcon({ progress, moving, reduced }) {
  // 이동 중일 때만 위아래로 살짝 흔들린다 - 정차(활주로에 선 상태) 중엔 고정.
  const hoverY = reduced || !moving ? 0 : Math.sin(progress * Math.PI * 4) * 2;
  return (
    <g className="vehicle-icon plane-icon" transform={`scale(0.65) translate(0, ${hoverY})`}>
      {/* Shadow */}
      <ellipse cx="0" cy="4" rx="16" ry="5" fill="rgba(0,0,0,0.06)" />
      {/* Body */}
      <ellipse cx="2" cy="0" rx="14" ry="3.5" fill="#3B82F6" />
      {/* Nose */}
      <ellipse cx="17" cy="0" rx="4" ry="2.5" fill="#2563EB" />
      {/* Wings */}
      <path d="M -2 -3 L -8 -14 L -4 -14 L 4 -3 Z" fill="#60A5FA" />
      <path d="M -2 3 L -8 14 L -4 14 L 4 3 Z" fill="#60A5FA" />
      {/* Tail */}
      <path d="M -14 -3 L -18 -8 L -16 -8 L -12 -3 Z" fill="#93C5FD" />
      <path d="M -14 3 L -18 8 L -16 8 L -12 3 Z" fill="#93C5FD" />
      {/* Cockpit */}
      <ellipse cx="16" cy="0" rx="2.5" ry="1.5" fill="rgba(255,255,255,0.8)" />
      {/* Window stripe */}
      <line x1="-6" y1="-2" x2="10" y2="-2" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
      <line x1="-6" y1="2" x2="10" y2="2" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
      {/* Engine */}
      <circle cx="-2" cy="-7" r="2" fill="#1E40AF" />
      <circle cx="-2" cy="7" r="2" fill="#1E40AF" />
    </g>
  );
}

// stops/countries가 안정적인 참조를 유지하는 한, stopIndex/shake/arrivalStop이
// 실제로 바뀔 때만 재렌더된다. 이제 타이핑 진행률(journeyProgress)을 아예
// prop으로 받지 않기 때문에, 한 글자 칠 때마다 지도가 다시 계산될 일도
// 없어졌다 - 정류장 도착(stopIndex 변경) 시에만 움직인다.
export const TravelMap = React.memo(TravelMapImpl);