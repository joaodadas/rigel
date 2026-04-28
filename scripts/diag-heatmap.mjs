import { geoBounds, geoMercator, geoPath } from "d3-geo";
import { readFileSync } from "node:fs";

const fc = JSON.parse(readFileSync("./public/maps/br-states.json", "utf-8"));

// Rewind: reverse all rings in Polygon / MultiPolygon
function rewindRing(ring) {
  return ring.slice().reverse();
}
function rewindGeom(geom) {
  if (geom.type === "Polygon") {
    return { ...geom, coordinates: geom.coordinates.map(rewindRing) };
  }
  if (geom.type === "MultiPolygon") {
    return {
      ...geom,
      coordinates: geom.coordinates.map((poly) => poly.map(rewindRing)),
    };
  }
  return geom;
}

const fcRewound = {
  ...fc,
  features: fc.features.map((f) => ({ ...f, geometry: rewindGeom(f.geometry) })),
};

console.log("Original FC bounds:", geoBounds(fc));
console.log("Rewound FC bounds:", geoBounds(fcRewound));
console.log("DF rewound bounds:", geoBounds(fcRewound.features.find((f) => f.properties.sigla === "DF")));
console.log("AC rewound bounds:", geoBounds(fcRewound.features.find((f) => f.properties.sigla === "AC")));

// Now test fitSize with rewound
const proj = geoMercator().fitSize([600, 520], fcRewound);
console.log("\nProj after fitSize on rewound: scale=", proj.scale().toFixed(2), "translate=", proj.translate());

const path = geoPath(proj);
console.log("\nProjected bbox per feature (should differ now):");
fcRewound.features.slice(0, 5).forEach((f) => {
  const b = path.bounds(f);
  console.log(`  ${f.properties.sigla}: ${JSON.stringify(b.map(p => p.map(v => v.toFixed(0))))}`);
});
