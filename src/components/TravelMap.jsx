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

      {/* Pastel Vector Land Countries */}
      <g className="map-countries" filter="url(#landShadow)">
        {countries.map((c) => (
          <path key={c.id} d={c.path} fill="#F4F4EE" stroke="#CBD5E1" strokeWidth="0.8" />
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

        <filter id="mapGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="landShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000000" floodOpacity="0.05" />
        </filter>
        <filter id="vehicleShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.2" />
        </filter>
        <filter id="stopShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.1" />
        </filter>
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
          <g key={stop.id} className={`map-stop ${state}`} transform={`translate(${stop.point[0]},${stop.point[1]})`}>
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
        filter="url(#vehicleShadow)"
      >
        <g className={`map-vehicle ${isFlight ? "is-flight" : isWalk ? "is-walk" : "is-bus"}`}>
          {isFlight ? (
            <PlaneIcon progress={travelT} moving={isTraveling} reduced={reducedMotion} />
          ) : isWalk ? (
            <WalkIcon progress={travelT} moving={isTraveling} reduced={reducedMotion} isFacingLeft={isFacingLeft} />
          ) : (
            <BusIcon progress={travelT} moving={isTraveling} reduced={reducedMotion} />
          )}
        </g>
      </g>
    </svg>
  );
}

function Wheel({ x }) {
  return (
    <g transform={`translate(${x}, 0)`}>
      <circle cx="0" cy="0" r="3.5" fill="#1E293B" />
      <circle cx="0" cy="0" r="2" fill="#94A3B8" />
      <circle cx="0" cy="0" r="0.8" fill="#F8FAFC" />
    </g>
  );
}

function BusIcon({ progress, moving, reduced }) {
  const wheelRot = reduced || !moving ? 0 : progress * 360 * 8;

  return (
    <g className="vehicle-icon bus-icon" transform="scale(0.42)">
      {/* Headlight cone (forward light beam) */}
      <polygon points="15,-6 45,-14 45,14 15,6" fill="rgba(251, 191, 36, 0.22)" filter="blur(1px)" />

      {/* Moving Exhaust Dust Particles */}
      {moving && !reduced && (
        <g opacity="0.6">
          <circle cx="-20" cy="3" r="2" fill="rgba(203, 213, 225, 0.6)">
            <animate attributeName="cx" values="-18;-34" dur="0.4s" repeatCount="indefinite" />
            <animate attributeName="r" values="1.5;4" dur="0.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0" dur="0.4s" repeatCount="indefinite" />
          </circle>
        </g>
      )}

      {/* Bus Shadow */}
      <ellipse cx="0" cy="3" rx="17" ry="7" fill="rgba(0,0,0,0.12)" />

      {/* Bus Outer Body */}
      <rect x="-16" y="-9" width="32" height="18" rx="6" fill="url(#busBodyGrad)" stroke="#047857" strokeWidth="0.8" />
      
      {/* Roof Shell & Air Conditioner Unit */}
      <rect x="-14" y="-10" width="26" height="3" rx="1.5" fill="#F8FAFC" opacity="0.9" />
      <rect x="-4" y="-11" width="8" height="2" rx="1" fill="#94A3B8" />

      {/* Side Windows */}
      <rect x="-11" y="-7" width="6" height="6" rx="1.5" fill="#E0F2FE" opacity="0.9" />
      <rect x="-3" y="-7" width="6" height="6" rx="1.5" fill="#E0F2FE" opacity="0.9" />
      <rect x="5" y="-7" width="6" height="6" rx="1.5" fill="#E0F2FE" opacity="0.9" />

      {/* Panoramic Front Windshield */}
      <path d="M12,-7 L16,-4 L16,4 L12,7 Z" fill="#93C5FD" opacity="0.95" />
      <line x1="13" y1="-5" x2="15" y2="3" stroke="#FFFFFF" strokeWidth="1" opacity="0.7" />

      {/* Wheels */}
      <g transform={`translate(-9, 9.5) rotate(${wheelRot})`}>
        <Wheel x={0} />
      </g>
      <g transform={`translate(8, 9.5) rotate(${wheelRot})`}>
        <Wheel x={0} />
      </g>

      {/* Front LED Headlights */}
      <circle cx="16" cy="-5" r="1.6" fill="#FBBF24" />
      <circle cx="16" cy="5" r="1.6" fill="#FBBF24" />

      {/* Rear Taillights */}
      <rect x="-16.5" y="-6" width="1" height="3" rx="0.5" fill="#EF4444" />
      <rect x="-16.5" y="3" width="1" height="3" rx="0.5" fill="#EF4444" />
    </g>
  );
}

function PlaneIcon({ progress, moving, reduced }) {
  const hoverY = reduced || !moving ? 0 : Math.sin(progress * Math.PI * 6) * 2;

  return (
    <g className="vehicle-icon plane-icon" transform={`scale(0.40) translate(0, ${hoverY})`}>
      {/* Jet Contrail Smoke Trail (비행운) */}
      {moving && (
        <g opacity="0.85">
          <path d="M-18,-6 Q-32,-7 -50,-8" stroke="url(#contrailGrad)" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M-18,6 Q-32,7 -50,8" stroke="url(#contrailGrad)" strokeWidth="3" strokeLinecap="round" fill="none" />
        </g>
      )}

      {/* Plane Drop Shadow */}
      <ellipse cx="0" cy="5" rx="19" ry="6" fill="rgba(0,0,0,0.12)" />

      {/* Port Wing (Top) */}
      <path d="M -3 -3 L -11 -18 L -5 -18 L 6 -3 Z" fill="#60A5FA" stroke="#2563EB" strokeWidth="0.5" />
      <polygon points="-11,-18 -13,-20 -9,-18" fill="#3B82F6" />

      {/* Starboard Wing (Bottom) */}
      <path d="M -3 3 L -11 18 L -5 18 L 6 3 Z" fill="#60A5FA" stroke="#2563EB" strokeWidth="0.5" />
      <polygon points="-11,18 -13,20 -9,18" fill="#3B82F6" />

      {/* Tail Stabilizers */}
      <path d="M -15 -2 L -20 -9 L -17 -9 L -11 -2 Z" fill="#93C5FD" />
      <path d="M -15 2 L -20 9 L -17 9 L -11 2 Z" fill="#93C5FD" />

      {/* Fuselage Main Body */}
      <path d="M-18,0 C-18,-5 12,-5 20,0 C12,5 -18,5 -18,0 Z" fill="url(#planeBodyGrad)" />
      
      {/* Cockpit Windshield */}
      <path d="M15,-2 C18,-2 19,0 19,0 C19,0 18,2 15,2 Z" fill="#F8FAFC" opacity="0.95" />

      {/* Passenger Window Stripe */}
      <line x1="-8" y1="-2.2" x2="10" y2="-2.2" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" strokeDasharray="1.5 1" />
      <line x1="-8" y1="2.2" x2="10" y2="2.2" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" strokeDasharray="1.5 1" />

      {/* Underwing Jet Engines */}
      <rect x="-3" y="-9" width="6" height="3" rx="1.5" fill="#1E40AF" />
      <rect x="-3" y="6" width="6" height="3" rx="1.5" fill="#1E40AF" />
      
      {/* Engine Exhaust Glow */}
      {moving && (
        <>
          <circle cx="-3" cy="-7.5" r="1.2" fill="#F59E0B" />
          <circle cx="-3" cy="7.5" r="1.2" fill="#F59E0B" />
        </>
      )}

      {/* Wingtip Navigation Lights (Red on Port, Green on Starboard) */}
      <circle cx="-11" cy="-18" r="1.5" fill="#EF4444" />
      <circle cx="-11" cy="18" r="1.5" fill="#22C55E" />
    </g>
  );
}

function WalkIcon({ progress, moving, reduced, isFacingLeft }) {
  const legAngle = reduced || !moving ? 0 : Math.sin(progress * Math.PI * 14) * 30;
  const armAngle = reduced || !moving ? 0 : -Math.sin(progress * Math.PI * 14) * 30;
  const bounceY = reduced || !moving ? 0 : Math.abs(Math.sin(progress * Math.PI * 14)) * -2.5;

  return (
    <g className="vehicle-icon walk-icon" transform={`scale(${isFacingLeft ? -0.42 : 0.42}, 0.42) translate(0, ${bounceY})`}>
      {/* Footsteps Dust Trail */}
      {moving && !reduced && (
        <g opacity="0.6">
          <circle cx="-8" cy="8" r="1.5" fill="#94A3B8">
            <animate attributeName="cx" values="-6;-16" dur="0.3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0" dur="0.3s" repeatCount="indefinite" />
          </circle>
        </g>
      )}

      {/* Traveler Shadow */}
      <ellipse cx="0" cy="8" rx="8" ry="3" fill="rgba(0,0,0,0.18)" />

      {/* Red Travel Backpack */}
      <rect x="-9" y="-8" width="5" height="9" rx="2" fill="#EF4444" stroke="#B91C1C" strokeWidth="0.6" />

      {/* Left Leg */}
      <g transform={`translate(-1, 2) rotate(${-legAngle})`}>
        <line x1="0" y1="0" x2="0" y2="7" stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="0.5" cy="7" r="1.2" fill="#3B82F6" />
      </g>

      {/* Right Leg */}
      <g transform={`translate(1, 2) rotate(${legAngle})`}>
        <line x1="0" y1="0" x2="0" y2="7" stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="0.5" cy="7" r="1.2" fill="#3B82F6" />
      </g>

      {/* Jacket / Torso */}
      <rect x="-4" y="-7" width="8" height="10" rx="3" fill="#10B981" />

      {/* Left Arm */}
      <g transform={`translate(-3, -4) rotate(${-armAngle})`}>
        <line x1="0" y1="0" x2="-3" y2="5" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" />
      </g>

      {/* Right Arm */}
      <g transform={`translate(3, -4) rotate(${armAngle})`}>
        <line x1="0" y1="0" x2="3" y2="5" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" />
      </g>

      {/* Head & Travel Cap */}
      <circle cx="0" cy="-11" r="3.5" fill="#FDE047" />
      <path d="M-5,-13 L5,-13 L3,-16 L-3,-16 Z" fill="#3B82F6" />
      <line x1="3" y1="-13" x2="7" y2="-13" stroke="#2563EB" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  );
}

export const TravelMap = React.memo(TravelMapImpl);