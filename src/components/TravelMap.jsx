import React, { useEffect, useRef, useState, useMemo } from "react";
import { getStopsViewBox, pointOnArc, segmentPath, flowBow, TRAVEL_MODES } from "../lib/geo";

const TRAVEL_DURATION_MS = 260;

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
      // Snappy, brisk camera tracking lerp (0.26)
      const next = current.map((v, i) => v + (target[i] - v) * 0.26);
      const settled = next.every((v, i) => Math.abs(v - target[i]) < 0.3);
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

function useVehicleTravel(stopIndex, reduced) {
  const [t, setT] = useState(1);
  const prevIndexRef = useRef(stopIndex);
  const frameRef = useRef(null);

  useEffect(() => {
    const prevIndex = prevIndexRef.current;
    prevIndexRef.current = stopIndex;

    if (prevIndex === stopIndex) return undefined;

    if (reduced) {
      setT(1);
      return undefined;
    }

    setT(0);
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / TRAVEL_DURATION_MS);
      // Brisk quintic ease-out curve (fast punchy takeoff)
      const eased = 1 - Math.pow(1 - progress, 4);
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
  const cityCounts = {};
  stops.forEach((s) => {
    cityCounts[s.city] = (cityCounts[s.city] || 0) + 1;
  });

  const labels = stops.map((stop) => {
    const isMultipleInCity = cityCounts[stop.city] > 1;
    const labelText = isMultipleInCity ? stop.name_ko : stop.city;

    return {
      x: stop.point[0],
      y: stop.point[1] - 7,
      anchor: "middle",
      text: labelText,
    };
  });

  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const dx = labels[j].x - labels[i].x;
      const dy = labels[j].y - labels[i].y;
      if (Math.abs(dx) < 45 && Math.abs(dy) < 10) {
        labels[j].y = labels[i].y + 12;
      }
    }
  }
  return labels;
}

const MapBackground = React.memo(function MapBackground({ countries, stops }) {
  return (
    <>
      {/* Metro Soft Sea Background */}
      <rect x="-2000" y="-2000" width="5000" height="5000" fill="#D4E6F1" />

      {/* Grid Graticule */}
      <g className="map-graticule" opacity="0.12">
        {Array.from({ length: 18 }).map((_, i) => (
          <line key={`v-${i}`} x1={i * 80 - 200} y1="-2000" x2={i * 80 - 200} y2="2000" stroke="#94A3B8" strokeDasharray="3 3" />
        ))}
        {Array.from({ length: 18 }).map((_, i) => (
          <line key={`h-${i}`} x1="-2000" y1={i * 80 - 200} x2="2000" y2={i * 80 - 200} stroke="#94A3B8" strokeDasharray="3 3" />
        ))}
      </g>

      {/* Faux Flat Shadow Layer for performance (bypasses SVG filters) */}
      <g className="map-countries-shadow" transform="translate(0, 3)">
        {countries.map((c) => (
          <path key={`shadow-${c.id}`} d={c.path} fill="rgba(0,0,0,0.06)" />
        ))}
      </g>

      {/* Pastel Vector Land Countries */}
      <g className="map-countries">
        {countries.map((c) => (
          <path key={c.id} d={c.path} fill="#F4F4EE" stroke="#CBD5E1" strokeWidth="0.8" strokeLinejoin="round" />
        ))}
      </g>

      {/* Full itinerary (ghosted metro route line) */}
      {stops.slice(1).map((stop, index) => {
        const from = stops[index];
        const { d } = segmentPath(from, stop, stop.mode, index);
        return (
          <path
            key={`route-${stop.id}`}
            className={`route-line ${stop.mode === TRAVEL_MODES.PLANE ? "is-flight" : stop.mode === TRAVEL_MODES.WALK ? "is-walk" : "is-bus"}`}
            d={d}
            stroke={stop.mode === TRAVEL_MODES.PLANE ? "#93C5FD" : stop.mode === TRAVEL_MODES.WALK ? "#FCD34D" : "#A7F3D0"}
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity="0.5"
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

  const framingStops = isTraveling ? [prevStop, current] : [current, next];
  const targetBox = getStopsViewBox(framingStops.filter(Boolean), 90, 260);
  const viewBox = useSmoothViewBox(targetBox, reducedMotion).join(" ");

  const isFlight = isTraveling
    ? current.mode === TRAVEL_MODES.PLANE
    : next?.mode === TRAVEL_MODES.PLANE;

  const isWalk = isTraveling
    ? current.mode === TRAVEL_MODES.WALK
    : next?.mode === TRAVEL_MODES.WALK;

  const bow = isTraveling ? flowBow(current.mode, stopIndex - 1) : 0;
  const vehiclePoint = isTraveling ? pointOnArc(prevStop.point, current.point, travelT, bow) : current.point;

  const lastAngleRef = useRef(0);
  const isFacingLeftRef = useRef(false);

  if (isTraveling) {
    const lookahead = travelT > 0.98
      ? pointOnArc(prevStop.point, current.point, Math.max(travelT - 0.02, 0), bow)
      : pointOnArc(prevStop.point, current.point, Math.min(travelT + 0.02, 1), bow);
    const dx = lookahead[0] - vehiclePoint[0];
    const dy = lookahead[1] - vehiclePoint[1];
    isFacingLeftRef.current = dx < 0;

    lastAngleRef.current = travelT > 0.98
      ? (Math.atan2(vehiclePoint[1] - lookahead[1], vehiclePoint[0] - lookahead[0]) * 180) / Math.PI
      : (Math.atan2(dy, dx) * 180) / Math.PI;
  }

  const vehicleAngle = isWalk ? 0 : lastAngleRef.current;
  const isFacingLeft = isFacingLeftRef.current;

  const labels = useMemo(() => resolveLabels(stops), [stops]);

  return (
    <svg className="travel-map" viewBox={viewBox} aria-hidden="true" style={{ userSelect: "none" }}>
      <defs>
        <radialGradient id="mapSea" cx="50%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#E0F2FE" />
          <stop offset="100%" stopColor="#BAE6FD" />
        </radialGradient>

        <linearGradient id="busBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>

        <linearGradient id="planeBodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="60%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>

        <linearGradient id="contrailGrad" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
          <stop offset="60%" stopColor="rgba(147,197,253,0.4)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        
        <linearGradient id="headlightGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(253, 230, 138, 0.45)" />
          <stop offset="10%" stopColor="rgba(253, 230, 138, 0.2)" />
          <stop offset="100%" stopColor="rgba(253, 230, 138, 0)" />
        </linearGradient>
      </defs>

      <MapBackground countries={countries} stops={stops} />

      {/* Travelled Metro Line Segments */}
      {stops.slice(1, stopIndex + 1).map((stop, index) => {
        const from = stops[index];
        const { d } = segmentPath(from, stop, stop.mode, index);
        const strokeColor =
          stop.mode === TRAVEL_MODES.PLANE
            ? "#3B82F6"
            : stop.mode === TRAVEL_MODES.WALK
            ? "#F59E0B"
            : "#10B981";
        return (
          <g key={`done-group-${stop.id}`}>
            <path
              className="route-line-core"
              d={d}
              stroke={strokeColor}
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </g>
        );
      })}

      {/* Active Metro Line Segment */}
      {!isTraveling && next ? (
        <g>
          <path
            className="route-line-core"
            d={segmentPath(current, next, next.mode, stopIndex).d}
            stroke={isFlight ? "#3B82F6" : isWalk ? "#F59E0B" : "#10B981"}
            strokeWidth="3.2"
            strokeDasharray={isFlight ? "4 4" : isWalk ? "3 3" : "none"}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      ) : null}

      {/* Metro Style Station Ring Markers */}
      {stops.map((stop, index) => {
        const state =
          index < stopIndex ? "is-visited" : index === stopIndex ? "is-current" : index === nextIndex ? "is-next" : "";
        const label = labels[index];
        const themeColor =
          stop.mode === TRAVEL_MODES.PLANE
            ? "#3B82F6"
            : stop.mode === TRAVEL_MODES.WALK
            ? "#F59E0B"
            : "#10B981";

        return (
          <g key={stop.id} className={`map-stop ${state} analog-pin`} transform={`translate(${stop.point[0]},${stop.point[1]})`}>
            {/* Halo for current active station */}
            {state === "is-current" ? (
              <circle r="10" className={`stop-halo ${arrivalStop ? "is-arrived" : ""}`} fill={themeColor} opacity="0.2" />
            ) : null}

            {/* Crisp Metro Ring Node */}
            {index < stopIndex ? (
              <circle r="2.8" fill={themeColor} stroke="#FFFFFF" strokeWidth="1" />
            ) : state === "is-current" ? (
              <circle r="4.8" fill="#FFFFFF" stroke={themeColor} strokeWidth="2.4" />
            ) : state === "is-next" ? (
              <circle r="3.6" fill="#FFFFFF" stroke={themeColor} strokeWidth="1.8" />
            ) : (
              <circle r="2.8" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.4" />
            )}

            {/* Metro Station Text Label */}
            <text
              className="stop-label"
              x={label.x - stop.point[0]}
              y={label.y - stop.point[1]}
              textAnchor={label.anchor}
            >
              {label.text}
            </text>
          </g>
        );
      })}

      {/* Compact Mini Vehicle Overlay */}
      <g
        className={`vehicle-wrapper ${shake ? "is-error" : ""}`}
        transform={`translate(${vehiclePoint[0]},${vehiclePoint[1]}) rotate(${vehicleAngle})`}
        style={{ transition: reducedMotion ? "none" : "transform 0.1s linear" }}
      >
        <g className={`map-vehicle ${isFlight ? "is-flight" : isWalk ? "is-walk" : "is-bus"}`}>
          {isFlight ? (
            <PlaneIcon moving={isTraveling} reduced={reducedMotion} />
          ) : isWalk ? (
            <WalkIcon moving={isTraveling} reduced={reducedMotion} isFacingLeft={isFacingLeft} />
          ) : (
            <BusIcon moving={isTraveling} reduced={reducedMotion} />
          )}
        </g>
      </g>
    </svg>
  );
}

function Wheel({ x, spinClass }) {
  return (
    <g transform={`translate(${x}, 0)`} className={spinClass}>
      <circle cx="0" cy="0" r="3.5" fill="#1E293B" />
      <circle cx="0" cy="0" r="2.2" fill="#64748B" />
      <path d="M 0 -2.2 L 0 2.2 M -2.2 0 L 2.2 0" stroke="#F1F5F9" strokeWidth="1" />
    </g>
  );
}

function BusIcon({ moving, reduced }) {
  const isAnimated = moving && !reduced;
  return (
    <g className="vehicle-icon bus-icon" transform="scale(0.42)">
      {isAnimated && (
        <polygon points="20,-6 75,-22 75,22 20,6" fill="url(#headlightGrad)" stroke="none" />
      )}
      <ellipse cx="0" cy="7" rx="22" ry="7" fill="rgba(0,0,0,0.2)" className={isAnimated ? "shadow-pulse" : ""} />
      
      <g className={isAnimated ? "bus-body-bounce" : ""}>
        <path d="M -22 -8 L -22 8 C -22 10 -19 11 -16 11 L 18 11 C 21 11 23 9 23 5 L 23 -3 C 23 -8 19 -10 15 -10 L -18 -10 C -20.5 -10 -22 -9 -22 -8 Z" fill="url(#busBodyGrad)" stroke="#047857" strokeWidth="1" />
        <path d="M -18 -8 L 15 -8 C 18 -8 20 -6 20 -2 L 20 2 C 20 4 18 5 15 5 L -18 5 C -19.5 5 -19.5 -5 -18 -8 Z" fill="#BAE6FD" opacity="0.9" stroke="#38BDF8" strokeWidth="0.5" />
        
        <rect x="-12" y="-8" width="2.5" height="13" fill="#047857" opacity="0.9" />
        <rect x="-2" y="-8" width="2.5" height="13" fill="#047857" opacity="0.9" />
        <rect x="8" y="-8" width="2.5" height="13" fill="#047857" opacity="0.9" />
        
        <line x1="-21" y1="8" x2="20" y2="8" stroke="#34D399" strokeWidth="1.2" opacity="0.9" />
        
        <g transform="translate(-14, 11)">
          <Wheel x={0} spinClass={isAnimated ? "spin-fast" : ""} />
        </g>
        <g transform="translate(12, 11)">
          <Wheel x={0} spinClass={isAnimated ? "spin-fast" : ""} />
        </g>
        
        <rect x="21" y="-5" width="2.5" height="4" rx="1.2" fill="#FEF08A" />
        <rect x="21" y="3" width="2.5" height="4" rx="1.2" fill="#FEF08A" />
        <rect x="-23" y="-6" width="1.5" height="12" rx="0.5" fill="#EF4444" />
      </g>
    </g>
  );
}

function PlaneIcon({ moving, reduced }) {
  const isAnimated = moving && !reduced;
  return (
    <g className="vehicle-icon plane-icon">
      <g className={isAnimated ? "plane-hover" : ""} transform="scale(0.40)">
        {moving && (
          <g opacity="0.9">
            <path d="M-18,-15 L-60,-20" stroke="url(#contrailGrad)" strokeWidth="4" strokeLinecap="round" fill="none" className="contrail-flicker" />
            <path d="M-18,15 L-60,20" stroke="url(#contrailGrad)" strokeWidth="4" strokeLinecap="round" fill="none" className="contrail-flicker" />
          </g>
        )}
        
        <ellipse cx="-4" cy="12" rx="28" ry="8" fill="rgba(0,0,0,0.18)" className={isAnimated ? "plane-shadow-pulse" : ""} />
        
        <path d="M -10 -4 L -25 -28 L -15 -28 L 8 -4 Z" fill="#60A5FA" stroke="#2563EB" strokeWidth="0.8" strokeLinejoin="round" />
        <path d="M -10 4 L -25 28 L -15 28 L 8 4 Z" fill="#60A5FA" stroke="#2563EB" strokeWidth="0.8" strokeLinejoin="round" />
        
        <path d="M -22 -2 L -32 -14 L -25 -14 L -18 -2 Z" fill="#93C5FD" stroke="#3B82F6" strokeWidth="0.6" strokeLinejoin="round" />
        <path d="M -22 2 L -32 14 L -25 14 L -18 2 Z" fill="#93C5FD" stroke="#3B82F6" strokeWidth="0.6" strokeLinejoin="round" />
        <path d="M -20 0 L -30 0 L -32 -8 L -24 0 Z" fill="#1D4ED8" opacity="0.8" />

        <path d="M-28,0 C-28,-6.5 16,-6.5 28,0 C16,6.5 -28,6.5 -28,0 Z" fill="url(#planeBodyGrad)" stroke="#1E40AF" strokeWidth="1" />
        
        <path d="M 18,-2.5 C 22,-2.5 25,0 25,0 C 25,0 22,2.5 18,2.5 Z" fill="#F8FAFC" opacity="0.95" />
        
        <g fill="rgba(255,255,255,0.9)">
          <circle cx="10" cy="-2.5" r="0.8" />
          <circle cx="6" cy="-3.0" r="0.8" />
          <circle cx="2" cy="-3.2" r="0.8" />
          <circle cx="-2" cy="-3.3" r="0.8" />
          <circle cx="-6" cy="-3.3" r="0.8" />
          <circle cx="-10" cy="-3.1" r="0.8" />
          
          <circle cx="10" cy="2.5" r="0.8" />
          <circle cx="6" cy="3.0" r="0.8" />
          <circle cx="2" cy="3.2" r="0.8" />
          <circle cx="-2" cy="3.3" r="0.8" />
          <circle cx="-6" cy="3.3" r="0.8" />
          <circle cx="-10" cy="3.1" r="0.8" />
        </g>
        
        <rect x="-14" y="-16" width="12" height="4.5" rx="2.2" fill="#1E40AF" />
        <rect x="-14" y="11.5" width="12" height="4.5" rx="2.2" fill="#1E40AF" />
        
        {moving && (
          <g>
            <circle cx="-14" cy="-13.75" r="1.8" fill="#FDE047" className={isAnimated ? "exhaust-flicker" : ""} />
            <circle cx="-14" cy="13.75" r="1.8" fill="#FDE047" className={isAnimated ? "exhaust-flicker" : ""} />
          </g>
        )}
        
        <circle cx="-25" cy="-28" r="1.5" fill="#EF4444" className={isAnimated ? "nav-light-blink" : ""} />
        <circle cx="-25" cy="28" r="1.5" fill="#22C55E" className={isAnimated ? "nav-light-blink" : ""} />
      </g>
    </g>
  );
}

function WalkIcon({ moving, reduced, isFacingLeft }) {
  const isAnimated = moving && !reduced;
  return (
    <g className="vehicle-icon walk-icon">
      <g transform={`scale(${isFacingLeft ? -0.44 : 0.44}, 0.44)`}>
        <g className={isAnimated ? "walk-bounce" : ""}>
          <ellipse cx="0" cy="11" rx="9" ry="3" fill="rgba(0,0,0,0.2)" className={isAnimated ? "shadow-pulse" : ""} />

          <path d="M -14 -6 L -16 -4 L -16 3 L -12 6 C -12 6 -10 6 -8 5 L -8 -6 Z" fill="#C2410C" stroke="#7C2D12" strokeWidth="0.8" />
          <rect x="-18" y="-2" width="4" height="4" rx="1" fill="#7C2D12" />

          <path d="M -7 -9 L 7 -9 C 9 -9 9 -5 8 1 L -6 1 Z" fill="#0EA5E9" />
          
          <g transform="translate(-2, 1)" className={isAnimated ? "walk-leg-left" : ""}>
            <path d="M -2 0 L 2 0 L 1 7 L -1 7 Z" fill="#334155" />
            <path d="M -2 7 L 3 7 Q 4 7 4 9 L -2 9 Z" fill="#78350F" />
          </g>
          <g transform="translate(2, 1)" className={isAnimated ? "walk-leg-right" : ""}>
            <path d="M -2 0 L 2 0 L 1 7 L -1 7 Z" fill="#334155" />
            <path d="M -2 7 L 3 7 Q 4 7 4 9 L -2 9 Z" fill="#78350F" />
          </g>
          
          <g transform="translate(1, -6)" className={isAnimated ? "walk-arm-left" : ""}>
            <line x1="0" y1="0" x2="-3" y2="7" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" />
          </g>
          
          <g className={isAnimated ? "head-bob" : ""}>
            <circle cx="2" cy="-14" r="4" fill="#FDE047" />
            <path d="M -2 -15 C -2 -19 5 -19 6 -15 L 10 -15 C 10 -15 10 -14 6 -14 L -2 -14 Z" fill="#1D4ED8" />
          </g>
          
          <g transform="translate(3, -6)" className={isAnimated ? "walk-arm-right" : ""}>
            <line x1="0" y1="0" x2="3" y2="7" stroke="#0369A1" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="3" cy="7" r="1.5" fill="#FDE047" />
          </g>
        </g>
      </g>
    </g>
  );
}

export const TravelMap = React.memo(TravelMapImpl);