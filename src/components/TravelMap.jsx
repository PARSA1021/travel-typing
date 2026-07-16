import React, { useEffect, useRef, useState, useMemo } from "react";
import { getStopsViewBox, pointOnArc, segmentPath, flowBow, TRAVEL_MODES } from "../lib/geo";

// Smoothly eases the camera from one viewBox to the next instead of snapping
function useSmoothViewBox(target) {
  const [box, setBox] = useState(target);
  const boxRef = useRef(target);
  const frameRef = useRef(null);

  useEffect(() => {
    boxRef.current = box;
  });

  useEffect(() => {
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
  }, target);

  return box;
}

// Simple label collision avoidance: shift labels that overlap
function resolveLabels(stops) {
  const labels = stops.map((stop, index) => ({
    x: stop.point[0],
    y: stop.point[1] - 18,
    anchor: "middle",
    city: stop.city,
    index,
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

export function TravelMap({ countries, stops, stopIndex, journeyProgress, shake }) {
  const nextIndex = stopIndex + 1 < stops.length ? stopIndex + 1 : null;
  const current = stops[stopIndex];
  const next = nextIndex === null ? null : stops[nextIndex];

  // Zoom camera to current segment instead of whole country
  const targetBox = getStopsViewBox([current, next].filter(Boolean), 120, 360);
  const viewBox = useSmoothViewBox(targetBox).join(" ");
  const isFlight = next?.mode === TRAVEL_MODES.PLANE;
  const bow = next ? flowBow(next.mode, stopIndex) : 0;
  const vehiclePoint = next ? pointOnArc(current.point, next.point, journeyProgress, bow) : current.point;
  const angleReference = next
    ? (journeyProgress > 0.98
      ? pointOnArc(current.point, next.point, journeyProgress - 0.02, bow)
      : pointOnArc(current.point, next.point, journeyProgress + 0.02, bow))
    : current.point;

  const vehicleAngle = next
    ? journeyProgress > 0.98
      ? (Math.atan2(vehiclePoint[1] - angleReference[1], vehiclePoint[0] - angleReference[0]) * 180) / Math.PI
      : (Math.atan2(angleReference[1] - vehiclePoint[1], angleReference[0] - vehiclePoint[0]) * 180) / Math.PI
    : 0;

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

      {/* Active segment */}
      {next ? (
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
            {/* Halo for current stop */}
            {state === "is-current" ? <circle r="18" className="stop-halo" /> : null}

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
        style={{ transition: "transform 0.15s ease-out" }}
        filter="url(#vehicleShadow)"
      >
        <g className={`map-vehicle ${isFlight ? "is-flight" : "is-bus"}`}>
          {isFlight ? <PlaneIcon progress={journeyProgress} /> : <BusIcon progress={journeyProgress} />}
        </g>
      </g>
    </svg>
  );
}

function BusIcon({ progress }) {
  const wheelRot = progress * 360 * 6; // 6 full rotations per segment
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
        <circle cx="0" cy="0" r="3" fill="#1F2937" />
        <circle cx="0" cy="0" r="1.5" fill="#6B7280" />
        <line x1="0" y1="-2" x2="0" y2="2" stroke="#D1D5DB" strokeWidth="0.8" />
        <line x1="-2" y1="0" x2="2" y2="0" stroke="#D1D5DB" strokeWidth="0.8" />
      </g>
      <g transform={`translate(6, 9) rotate(${wheelRot})`}>
        <circle cx="0" cy="0" r="3" fill="#1F2937" />
        <circle cx="0" cy="0" r="1.5" fill="#6B7280" />
        <line x1="0" y1="-2" x2="0" y2="2" stroke="#D1D5DB" strokeWidth="0.8" />
        <line x1="-2" y1="0" x2="2" y2="0" stroke="#D1D5DB" strokeWidth="0.8" />
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

function PlaneIcon({ progress }) {
  // Gentle bobbing effect based on progress (sine wave)
  const hoverY = Math.sin(progress * Math.PI * 4) * 2;
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