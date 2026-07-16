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

export function getFreeRideStops(routes, count = 12) {
  const all = routes.flatMap((route) => route.stops);
  const shuffled = [...all].sort(() => Math.random() - 0.5).slice(0, count);
  return withTravelModes(shuffled);
}

export function projectStops(stops, projection) {
  return stops.map((stop) => ({
    ...stop,
    point: projection(stop.coordinates),
  }));
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