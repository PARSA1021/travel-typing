import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";

export const MAP_VIEWBOX = [-40, 300, 780, 560];

export const TRAVEL_MODES = {
  START: "start",
  BUS: "bus",
  PLANE: "plane",
};

// Bounding box roughly covering France / Switzerland / Italy so every
// itinerary in travel-routes.json fits comfortably on screen.
const FOCUS_BOUNDS = {
  type: "Polygon",
  coordinates: [
    [
      [-5.2, 36.5],
      [-5.2, 52.5],
      [15.8, 52.5],
      [15.8, 36.5],
      [-5.2, 36.5],
    ],
  ],
};

export function buildGeoModel(topology) {
  const collection = feature(topology, topology.objects.countries);
  const projection = geoMercator().fitExtent(
    [
      [10, 10],
      [980, 860],
    ],
    FOCUS_BOUNDS,
  );
  const path = geoPath(projection);
  const countries = collection.features.map((country) => ({
    id: country.id,
    path: path(country),
  }));
  return { countries, projection };
}

// The arrival mode for a stop is derived purely from whether its country
// differs from the previous stop's country - this is what lets both single
// route playback AND the merged Grand Tour automatically alternate between
// bus (same country) and plane (crossing a border) without hard-coding it
// per route.
export function withTravelModes(stops) {
  return stops.map((stop, index) => {
    if (index === 0) return { ...stop, mode: TRAVEL_MODES.START };
    const previous = stops[index - 1];
    return {
      ...stop,
      mode:
        previous.country === stop.country ? TRAVEL_MODES.BUS : TRAVEL_MODES.PLANE,
    };
  });
}

export function getRouteStops(routes, routeId) {
  const route = routes.find((item) => item.id === routeId);
  return route ? withTravelModes(route.stops) : [];
}

export function getGrandTourStops(routes) {
  return withTravelModes(routes.flatMap((route) => route.stops));
}

// sort(() => Math.random() - 0.5)는 편향된(진짜 균등분포가 아닌) 셔플이라
// 특정 항목이 앞/뒤로 쏠리는 경향이 있다. Fisher-Yates로 교체.
function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function getFreeRideStops(routes, count = 12) {
  const all = routes.flatMap((route) => route.stops);
  const shuffled = shuffle(all).slice(0, count);
  return withTravelModes(shuffled);
}

// Stops inside the same city sit only 0-2 map units apart once projected
// (a few real-world meters against a map that spans France/Switzerland/
// Italy), while a cross-border hop can be 100+ units. Left as-is, the camera
// and vehicle both read those short intra-city hops as "no movement" - only
// the big country-crossing flights look like they're going anywhere. This
// walks the route in order and, whenever a stop lands too close to the one
// before it, pushes it out to MIN_STOP_SEPARATION along the same direction
// (or a deterministic fan-out angle if the coordinates are effectively
// identical). Legs that are already far apart are left untouched, so real
// city-to-city and country-to-country distances still read as bigger jumps.
const MIN_STOP_SEPARATION = 100;

function spreadClusteredPoints(stops, minDistance) {
  // A running "heading" carries the direction of travel from one synthetic
  // hop to the next. Picking each hop's angle independently (from tiny,
  // noisy real coordinates, or a big fixed jump for identical ones) made
  // consecutive stops swing back toward each other - it reads as the
  // vehicle bouncing in place rather than going somewhere. Instead, each
  // step nudges the heading gently toward the true direction (when there is
  // one) and otherwise keeps curving the same way it was already curving,
  // so the path always flows forward.
  const MAX_TURN = Math.PI / 5; // 36 degrees per hop, keeps corners gentle
  const DRIFT_TURN = Math.PI / 9; // 20 degrees, used when no direction signal exists
  // Real coordinates inside the same city can differ by a fraction of a map
  // unit - that's GPS-level noise, not a meaningful direction. Letting it
  // steer the heading was the actual bug: two noisy signals a hop apart
  // would point in near-opposite directions, and clamped or not, nudging
  // toward first one then the other read as the vehicle bouncing in place.
  // Only offsets clearly bigger than that noise floor are trusted as a real
  // direction hint.
  const NOISE_FLOOR = 5;
  // Direction hints must come from the ORIGINAL, unshifted coordinates -
  // once a point has already been nudged out to minDistance, measuring the
  // "next" direction from that shifted point against a still-untouched real
  // point mixes two different scales and produces meaningless deltas (this
  // was the actual source of the 180-degree flips). The cascade itself -
  // where each new point is placed - still builds off the previous
  // (possibly already-shifted) point so the drawn path stays continuous.
  const originalPoints = stops.map((stop) => stop.point);
  let heading = 0;
  let headingKnown = false;

  for (let i = 1; i < stops.length; i++) {
    const trueDx = originalPoints[i][0] - originalPoints[i - 1][0];
    const trueDy = originalPoints[i][1] - originalPoints[i - 1][1];
    const trueDistance = Math.hypot(trueDx, trueDy);

    if (trueDistance >= minDistance) {
      // Real, already-visible hop: adopt its direction so the next
      // synthetic stretch flows out of it naturally. Its point is left as
      // the true coordinate - no adjustment needed.
      heading = Math.atan2(trueDy, trueDx);
      headingKnown = true;
      continue;
    }

    const rawAngle = trueDistance > NOISE_FLOOR ? Math.atan2(trueDy, trueDx) : null;
    if (!headingKnown) {
      heading = rawAngle ?? 0;
      headingKnown = true;
    } else if (rawAngle !== null) {
      let delta = rawAngle - heading;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta)); // wrap to [-PI, PI]
      delta = Math.max(-MAX_TURN, Math.min(MAX_TURN, delta));
      heading += delta;
    } else {
      heading += DRIFT_TURN;
    }

    const anchor = stops[i - 1].point;
    stops[i] = {
      ...stops[i],
      point: [anchor[0] + Math.cos(heading) * minDistance, anchor[1] + Math.sin(heading) * minDistance],
    };
  }
  return stops;
}

export function projectStops(stops, projection) {
  const projected = stops.map((stop) => ({
    ...stop,
    point: projection(stop.coordinates),
  }));
  return spreadClusteredPoints(projected, MIN_STOP_SEPARATION);
}

export function getStopsViewBox(stops, padding = 70, minSize = 220) {
  const points = stops.map((stop) => stop.point).filter(Boolean);
  if (!points.length) return MAP_VIEWBOX;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX + padding * 2, minSize);
  const height = Math.max(maxY - minY + padding * 2, width * 0.62);
  return [(minX + maxX - width) / 2, (minY + maxY - height) / 2, width, height];
}

export function pointsToPath(points) {
  return points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
}

// A gentle arc (quadratic bezier) rather than a straight line reads more
// like a flight path on the map for plane hops between countries.
export function arcPath([x1, y1], [x2, y2], bow = 0.18) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx = mx - dy * bow;
  const cy = my + dx * bow;
  return { d: `M${x1.toFixed(2)},${y1.toFixed(2)} Q${cx.toFixed(2)},${cy.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)}`, control: [cx, cy] };
}

// Point at parameter t (0-1) along the same quadratic bezier used by arcPath,
// so the moving bus/plane icon follows the drawn line exactly.
export function pointOnArc([x1, y1], [x2, y2], t, bow = 0.18) {
  const { control } = arcPath([x1, y1], [x2, y2], bow);
  const [cx, cy] = control;
  const it = 1 - t;
  return [
    it * it * x1 + 2 * it * t * cx + t * t * x2,
    it * it * y1 + 2 * it * t * cy + t * t * y2,
  ];
}

// Every leg of the trip - bus or plane - is drawn as a soft curve rather than
// a hard straight line, so the whole itinerary reads as one continuous,
// flowing route instead of a rigid connect-the-dots diagram. Plane hops bow
// more (a "flight arc"); bus hops bow just enough to feel like a road curving
// around the land rather than cutting through it. The sign alternates by
// index so consecutive curves don't stack on the same side and cross.
export function flowBow(mode, index = 0) {
  const side = index % 2 === 0 ? 1 : -1;
  return mode === TRAVEL_MODES.PLANE ? side * 0.25 : 0;
}

export function segmentPath(from, to, mode, index = 0) {
  return arcPath(from.point, to.point, flowBow(mode, index));
}