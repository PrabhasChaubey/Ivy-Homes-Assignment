// inspect-mag.mjs
// Focused look at the MAG-* carpet_area anomaly. Run: node inspect-mag.mjs
import dotenv from "dotenv";
dotenv.config();
import { readFile } from "node:fs/promises";
const listings = JSON.parse(await readFile("./data/listings.json"));

const byPrefix = {};
for (const l of listings) {
  const prefix = l.listing_id.split("-")[0];
  (byPrefix[prefix] ??= []).push(l);
}

console.log("Per-prefix summary (raw, uncorrected values):");
for (const [prefix, group] of Object.entries(byPrefix).sort()) {
  const withBoth = group.filter((l) => l.carpet_area > 0 && l.super_built_up_area > 0);
  const avgCarpet = withBoth.reduce((s, l) => s + l.carpet_area, 0) / withBoth.length;
  const avgSuper = withBoth.reduce((s, l) => s + l.super_built_up_area, 0) / withBoth.length;
  const avgBedroom = group.reduce((s, l) => s + (l.bedroom || 0), 0) / group.length;
  console.log(
    `  ${prefix}: n=${group.length}, avg carpet_area=${avgCarpet.toFixed(1)}, avg super_built_up=${avgSuper.toFixed(1)}, ratio(carpet/super)=${(avgCarpet / avgSuper).toFixed(3)}, avg bedroom=${avgBedroom.toFixed(2)}`
  );
}

console.log("\n5 raw MAG-* records in full (no correction applied):");
const magSample = listings.filter((l) => l.listing_id.startsWith("MAG-")).slice(0, 5);
for (const l of magSample) {
  console.log(JSON.stringify({
    listing_id: l.listing_id, website: l.website, bedroom: l.bedroom, bathroom: l.bathroom,
    carpet_area: l.carpet_area, super_built_up_area: l.super_built_up_area,
    price: l.price, property_type: l.property_type,
  }));
}

console.log("\n5 raw non-MAG records for comparison (e.g. ZER-*):");
const zerSample = listings.filter((l) => l.listing_id.startsWith("ZER-")).slice(0, 5);
for (const l of zerSample) {
  console.log(JSON.stringify({
    listing_id: l.listing_id, website: l.website, bedroom: l.bedroom, bathroom: l.bathroom,
    carpet_area: l.carpet_area, super_built_up_area: l.super_built_up_area,
    price: l.price, property_type: l.property_type,
  }));
}
