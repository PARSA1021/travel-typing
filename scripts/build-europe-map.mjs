// Extracts a small topojson subset (France, Switzerland, Italy + light
// neighbour context) from the `world-atlas` package so the game map has a
// real, recognisable coastline without shipping the full 110m world file.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(
  __dirname,
  "..",
  "node_modules",
  "world-atlas",
  "countries-110m.json",
);
const outFile = path.join(__dirname, "..", "public", "data", "europe.topo.json");

// Numeric ISO-3166-1 country codes used by world-atlas.
const FOCUS_IDS = new Set(["250", "756", "380"]); // France, Switzerland, Italy
const CONTEXT_IDS = new Set([
  "276", "724", "056", "528", "826", "372", "232", "233", "246", "428",
  "440", "578", "752", "616", "203", "703", "348", "040", "705", "191",
  "070", "499", "807", "008", "300", "792", "804", "643", "112", "112",
]); // rough Western/Central Europe for visual context only

const topology = JSON.parse(await readFile(source, "utf8"));
const geometries = topology.objects.countries.geometries.filter(
  (geometry) => FOCUS_IDS.has(geometry.id) || CONTEXT_IDS.has(geometry.id),
);

const trimmed = {
  ...topology,
  objects: {
    countries: {
      ...topology.objects.countries,
      geometries,
    },
  },
};

await writeFile(outFile, JSON.stringify(trimmed));
console.log(
  `Wrote ${geometries.length} country geometries to ${path.relative(process.cwd(), outFile)}`,
);
