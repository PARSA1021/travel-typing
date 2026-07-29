import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";

export const MAP_VIEWBOX = [-40, 300, 780, 560];

export const TRAVEL_MODES = {
  START: "start",
  WALK: "walk",
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

// Derive travel mode dynamically:
// - Different country: PLANE (비행기 ✈️)
// - Same city or close GPS distance (< 0.035 deg / ~3.5km): WALK (도보/뚜벅이 🚶‍♂️)
// - Same country, further distance: BUS (버스/기차 🚌)
export function withTravelModes(stops) {
  return stops.map((stop, index) => {
    if (index === 0) return { ...stop, mode: TRAVEL_MODES.START };
    const previous = stops[index - 1];

    if (previous.country !== stop.country) {
      return { ...stop, mode: TRAVEL_MODES.PLANE };
    }

    const [lng1, lat1] = previous.coordinates;
    const [lng2, lat2] = stop.coordinates;
    const dist = Math.hypot(lng2 - lng1, lat2 - lat1);

    if (previous.city === stop.city || dist < 0.035) {
      return { ...stop, mode: TRAVEL_MODES.WALK };
    }

    return { ...stop, mode: TRAVEL_MODES.BUS };
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
const MIN_STOP_SEPARATION = 55;

function spreadClusteredPoints(stops, minDistance) {
  const MAX_TURN = Math.PI / 5;
  const DRIFT_TURN = Math.PI / 9;
  const NOISE_FLOOR = 2;
  const originalPoints = stops.map((stop) => stop.point);
  let heading = 0;
  let headingKnown = false;

  for (let i = 1; i < stops.length; i++) {
    const trueDx = originalPoints[i][0] - originalPoints[i - 1][0];
    const trueDy = originalPoints[i][1] - originalPoints[i - 1][1];
    const trueDistance = Math.hypot(trueDx, trueDy);

    if (trueDistance >= minDistance) {
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
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
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
  const projected = stops.map((stop) => {
    const rawPoint = projection(stop.coordinates);
    return {
      ...stop,
      point: rawPoint,
      realPoint: rawPoint, // 100% exact true GPS coordinate projection
    };
  });
  return spreadClusteredPoints(projected, MIN_STOP_SEPARATION);
}

export function getStopsViewBox(stops, padding = 60, defaultMinSize = 220) {
  const points = stops.map((stop) => stop.point).filter(Boolean);
  if (!points.length) return MAP_VIEWBOX;

  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const rawDist = Math.hypot(spanX, spanY);

  // Dynamic adaptive camera zoom:
  // For small intra-city GPS hops (e.g. within Paris or Florence), zoom camera close (small minSize).
  // For large cross-country hops (e.g. Paris to Interlaken), expand camera view (large minSize).
  let adaptiveMinSize = defaultMinSize;
  if (rawDist < 30) {
    adaptiveMinSize = Math.max(rawDist * 3.5, 55);
  } else if (rawDist < 100) {
    adaptiveMinSize = Math.max(rawDist * 2.2, 110);
  } else {
    adaptiveMinSize = Math.max(rawDist * 1.3, defaultMinSize);
  }

  const width = Math.max(spanX + padding * 1.8, adaptiveMinSize);
  const height = Math.max(spanY + padding * 1.8, width * 0.62);
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