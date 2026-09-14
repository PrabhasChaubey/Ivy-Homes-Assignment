// analyze.mjs
// Run AFTER fetch-data.mjs. Computes draft answers to the 10 questions and
// prints diagnostics for everything that needs a human judgment call
// (duplicates, corrupt records, fake listings, unit/timezone anomalies).
//
// This is a starting point, not a finisher — read the [DIAGNOSTIC] sections,
// they're where the real findings are.
import dotenv from "dotenv";
dotenv.config();
import { readFile } from "node:fs/promises";

const REFERENCE = new Date("2026-09-10T00:00:00+05:30");
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const listings = JSON.parse(await readFile("./data/listings.json"));
const rentals = JSON.parse(await readFile("./data/rentals.json"));
const projects = JSON.parse(await readFile("./data/projects.json"));

const ASSIGNED_LOCALITY = "tambaram"; // change if yours differs; must match API's lowercase form

console.log(`Loaded ${listings.length} listings, ${rentals.length} rentals, ${projects.length} projects\n`);

// ---------- Q1: total_listing_records ----------
console.log("Q1 total_listing_records:", listings.length);

// ---------- Q2: unique_properties ----------
// Hypothesis: the same physical property appears as multiple listing_ids,
// likely sourced from different `website` values. Cluster by rounded
// lat/long + bedroom + carpet_area as a proxy for "same property".
function propertyKey(l) {
  const lat = Math.round(l.latitude * 1000) / 1000;
  const lng = Math.round(l.longitude * 1000) / 1000;
  return `${lat},${lng},${l.bedroom},${l.carpet_area}`;
}
const clusters = new Map();
for (const l of listings) {
  const key = propertyKey(l);
  if (!clusters.has(key)) clusters.set(key, []);
  clusters.get(key).push(l);
}
const multiRecordClusters = [...clusters.values()].filter((c) => c.length > 1);
console.log(`\n[DIAGNOSTIC] Q2 unique_properties (heuristic, VERIFY):`, clusters.size);
console.log(`  ${multiRecordClusters.length} clusters have >1 record (candidate duplicates).`);
console.log(`  Sample cluster:`, multiRecordClusters[0]?.map((l) => ({
  id: l.listing_id, website: l.website, price: l.price, apartment_name: l.apartment_name,
})));
console.log(`  -> Inspect a few of these by hand. Are they truly the same property (same`);
console.log(`     apartment_name/floor, different website/listing_id/price)? If so this`);
console.log(`     heuristic is roughly right and it's a "duplicates" finding.`);

// ---------- Q3: active_listings (is_live) ----------
const hasIsLive = listings.some((l) => "is_live" in l);
console.log(`\n[DIAGNOSTIC] does 'is_live' field exist on listing objects? ${hasIsLive}`);
if (hasIsLive) {
  const active = listings.filter((l) => l.is_live === true).length;
  const inactive = listings.length - active;
  console.log("Q3 active_listings:", active, `(${inactive} have is_live=false — undocumented field + contradicts "returns active listings" doc claim if any are false)`);
} else {
  console.log("  [!] 'is_live' not found — check field name spelling in actual payload above (fetch-data.mjs prints all fields seen).");
}

// ---------- Check: is there a per-source unit bug in carpet_area? ----------
console.log("\n[DIAGNOSTIC] carpet_area stats grouped by listing_id prefix / website (checking for a per-source sqm-vs-sqft bug):");
const bySource = new Map();
for (const l of listings) {
  const prefix = l.listing_id.split("-")[0];
  if (!bySource.has(prefix)) bySource.set(prefix, []);
  bySource.get(prefix).push(l);
}
for (const [prefix, group] of [...bySource.entries()].sort()) {
  const websites = [...new Set(group.map((l) => l.website))];
  const avgCarpet = group.reduce((s, l) => s + (l.carpet_area || 0), 0) / group.length;
  const avgSuper = group.reduce((s, l) => s + (l.super_built_up_area || 0), 0) / group.length;
  const avgRatio = avgCarpet / avgSuper;
  console.log(`  ${prefix} (website=${websites.join(",")}, n=${group.length}): avg carpet_area=${avgCarpet.toFixed(0)}, avg super_built_up=${avgSuper.toFixed(0)}, carpet/super ratio=${avgRatio.toFixed(3)}`);
}
console.log("  -> A healthy ratio is ~0.75-0.9 (carpet slightly less than super built-up).");
console.log("     If all prefixes show a similar ratio here, there's no source-wide units bug —");
console.log("     any implausible individual records below are genuine one-off data_quality issues,");
console.log("     not a systemic 'units' finding. (Confirmed via inspect-mag.mjs: all ~0.75-0.76.)");

// ---------- Per-record units check (not per-source) ----------
// inspect-mag.mjs showed MAG-4003885 (carpet=111, super=150, bedroom=3) has a
// NORMAL carpet/super ratio (0.74) but an impossible absolute size — both
// fields shrunk together, consistent with THAT RECORD being in sqm while most
// records are in sqft. Detect this per-record via super_built_up/bedroom.
const perBedroomRatios = listings
  .filter((l) => l.bedroom > 0 && l.super_built_up_area > 0)
  .map((l) => l.super_built_up_area / l.bedroom)
  .sort((a, b) => a - b);
const medianPerBedroom = perBedroomRatios[Math.floor(perBedroomRatios.length / 2)];
console.log(`\n[DIAGNOSTIC] median super_built_up_area per bedroom (dataset-wide): ${medianPerBedroom.toFixed(1)} sqft`);

const SQM_TO_SQFT = 10.7639;
let unitFixedCount = 0;
const unitFixedIds = [];
for (const l of listings) {
  l.__carpet_area_corrected = l.carpet_area;
  l.__super_built_up_corrected = l.super_built_up_area;
  if (l.bedroom > 0 && l.super_built_up_area > 0) {
    const perBedroom = l.super_built_up_area / l.bedroom;
    // suspiciously small (< 1/5 of normal) AND correcting it lands back in a
    // plausible range — that combination is our evidence, not just the raw smallness
    if (perBedroom < medianPerBedroom / 5) {
      const correctedPerBedroom = (l.super_built_up_area * SQM_TO_SQFT) / l.bedroom;
      if (correctedPerBedroom > medianPerBedroom / 3 && correctedPerBedroom < medianPerBedroom * 3) {
        l.__carpet_area_corrected = Math.round(l.carpet_area * SQM_TO_SQFT);
        l.__super_built_up_corrected = Math.round(l.super_built_up_area * SQM_TO_SQFT);
        l.__units_fixed = true;
        unitFixedCount++;
        if (unitFixedIds.length < 20) unitFixedIds.push(l.listing_id);
      }
    }
  }
}
console.log(`  ${unitFixedCount} records look like they're recorded in sqm (both carpet_area and`);
console.log(`  super_built_up_area implausibly small, but plausible again ×10.7639). Sample ids`);
console.log(`  for findings evidence (up to 20):`, JSON.stringify(unitFixedIds));

// Hypotheses for "cannot exist": carpet_area > super_built_up_area, floor > total_floors,
// non-positive price/area, bedroom <= 0, bathroom wildly > bedroom, missing required fields.
const corrupt = listings.filter((l) => {
  const reasons = [];
  const carpet = l.__carpet_area_corrected;
  const superArea = l.__super_built_up_corrected;
  if (carpet != null && superArea != null && carpet > superArea) reasons.push("carpet>super_built_up");
  if (l.floor != null && l.total_floors != null && l.floor > l.total_floors) reasons.push("floor>total_floors");
  if (l.price != null && l.price <= 0) reasons.push("price<=0");
  if (carpet != null && carpet <= 0) reasons.push("area<=0");
  const isLandType = ["plot", "land"].includes((l.property_type || "").toLowerCase());
  if (!isLandType && l.bedroom != null && l.bedroom <= 0) reasons.push("bedroom<=0 (non-plot)");
  if (l.bathroom != null && l.bedroom != null && l.bathroom > l.bedroom + 3) reasons.push("bathroom>>bedroom");
  // price physically impossible relative to area — a built apartment cannot
  // cost less than ~Rs 500/sqft even in the cheapest real market
  if (l.price != null && carpet > 0 && l.price / carpet < 500) reasons.push("price/sqft implausibly low (<500)");
  // carpet_area physically impossible relative to bedroom count, AFTER
  // per-record units correction — anything still this small is a genuine
  // data_quality problem, not a units problem
  if (!isLandType && l.bedroom > 0 && carpet > 0 && carpet < l.bedroom * 150) reasons.push("carpet_area implausibly small for bedroom count (even after per-record unit check)");
  l.__corrupt_reasons = reasons;
  return reasons.length > 0;
});
console.log(`\n[DIAGNOSTIC] Q4 candidate corrupt_listing_ids (${corrupt.length}), FULL list (after per-record units correction):`);
for (const l of corrupt) {
  console.log(`  ${l.listing_id}: ${l.__corrupt_reasons.join(", ")}`);
}
console.log("  -> Verify each reason actually indicates 'cannot exist' rather than just unusual.");
console.log("  Sorted ids for submission.json:", JSON.stringify(corrupt.map((l) => l.listing_id).sort()));

// ---------- Q5: total_monthly_rent in assigned locality ----------
const localityRentals = rentals.filter((r) => (r.locality || "").toLowerCase() === ASSIGNED_LOCALITY);
const totalRent = localityRentals.reduce((sum, r) => sum + (r.price || 0), 0);
console.log(`\nQ5 total_monthly_rent (${ASSIGNED_LOCALITY}):`, totalRent, `(over ${localityRentals.length} rentals)`);
if (localityRentals.length === 0) {
  console.log(`  [!] No rentals matched locality "${ASSIGNED_LOCALITY}" — check exact spelling/casing in data (see distinct localities below).`);
}
const distinctLocalities = [...new Set(rentals.map((r) => r.locality))].sort();
console.log("  Distinct rental localities seen:", distinctLocalities);

// ---------- Q6: avg_price_per_sqft_2bhk ----------
// Excludes corrupt (Q4) and fake (Q9) ids — Q9 not computed yet, so this is
// a first pass excluding only Q4 candidates. Re-run once Q9 is nailed down.
const corruptIds = new Set(corrupt.map((l) => l.listing_id));
const eligible2bhk = listings.filter(
  (l) => l.is_live === true && l.bedroom === 2 && !corruptIds.has(l.listing_id) && l.__carpet_area_corrected > 0
);
const ratios = eligible2bhk.map((l) => l.price / l.__carpet_area_corrected);
const avgPsf = ratios.reduce((a, b) => a + b, 0) / ratios.length;
console.log(`\nQ6 avg_price_per_sqft_2bhk (unit-corrected, excl. Q4 only, NOT yet excl. Q9):`, avgPsf.toFixed(2), `(n=${eligible2bhk.length})`);
// flag outliers that might indicate a unit swap (e.g. area in sqm not sqft)
const sorted = [...ratios].sort((a, b) => a - b);
console.log("  min/p5/median/p95/max price-per-sqft:", [
  sorted[0], sorted[Math.floor(sorted.length * 0.05)], sorted[Math.floor(sorted.length * 0.5)],
  sorted[Math.floor(sorted.length * 0.95)], sorted[sorted.length - 1],
].map((n) => n?.toFixed(2)));
console.log("  -> If min/max are wildly off from the median, check those records for a unit issue.");
const lowestPsf = [...eligible2bhk].sort((a, b) => a.price / a.__carpet_area_corrected - b.price / b.__carpet_area_corrected).slice(0, 5);
const highestPsf = [...eligible2bhk].sort((a, b) => b.price / b.__carpet_area_corrected - a.price / a.__carpet_area_corrected).slice(0, 5);
console.log("  Lowest price/sqft records (inspect for unit errors):", lowestPsf.map((l) => ({ id: l.listing_id, price: l.price, carpet_area: l.__carpet_area_corrected, psf: (l.price / l.__carpet_area_corrected).toFixed(2) })));
console.log("  Highest price/sqft records (inspect — could be genuine luxury or an error):", highestPsf.map((l) => ({ id: l.listing_id, price: l.price, carpet_area: l.__carpet_area_corrected, psf: (l.price / l.__carpet_area_corrected).toFixed(2) })));

// ---------- Q7: costliest_project ----------
const priceMaxSorted = [...projects.map((p) => p.price_max)].sort((a, b) => a - b);
console.log("\n[DIAGNOSTIC] price_max distribution across all projects (check for a units issue):");
console.log("  min/p25/median/p75/max:", [
  priceMaxSorted[0],
  priceMaxSorted[Math.floor(priceMaxSorted.length * 0.25)],
  priceMaxSorted[Math.floor(priceMaxSorted.length * 0.5)],
  priceMaxSorted[Math.floor(priceMaxSorted.length * 0.75)],
  priceMaxSorted[priceMaxSorted.length - 1],
]);
console.log("  -> If these all look like small numbers (tens to hundreds) rather than");
console.log("     8-10 digit rupee amounts, price_min/price_max are probably recorded in");
console.log("     CRORES, not rupees as documented. That's a 'units' finding, and it");
console.log("     changes what price_max_inr should actually be for Q7 (multiply by 1e7).");

const priceMinSorted = [...projects.map((p) => p.price_min)].sort((a, b) => a - b);
console.log("  price_min min/p25/median/p75/max:", [
  priceMinSorted[0],
  priceMinSorted[Math.floor(priceMinSorted.length * 0.25)],
  priceMinSorted[Math.floor(priceMinSorted.length * 0.5)],
  priceMinSorted[Math.floor(priceMinSorted.length * 0.75)],
  priceMinSorted[priceMinSorted.length - 1],
]);

const costliest = projects.reduce((best, p) => (p.price_max > (best?.price_max ?? -Infinity) ? p : best), null);
console.log("\nQ7 costliest_project (raw field, verify units first):", costliest && { project_id: costliest.project_id, price_max_inr: costliest.price_max });
console.log("  If units are crores: price_max_inr should be", costliest && costliest.price_max * 1e7);

// ---------- Q8: listings_last_7_days ----------
const windowStart = new Date(REFERENCE.getTime() - SEVEN_DAYS_MS);
function parseIST(ts) {
  // handle both a trailing Z (UTC) and an explicit +05:30 offset, per the
  // documentation's claim vs. the suspected reality
  return new Date(ts);
}
const in7d = listings.filter((l) => {
  const d = parseIST(l.posted_at);
  return d >= windowStart && d < REFERENCE;
});
console.log(`\nQ8 listings_last_7_days:`, in7d.length);
const offsetSamples = listings.slice(0, 5).map((l) => l.posted_at);
console.log("  Sample posted_at values (check offset format):", offsetSamples);

// ---------- Q9: fake_listing_ids ----------
console.log("\n[DIAGNOSTIC] Q9 fake_listing_ids — checking description duplication across DIFFERENT properties:");
const descCounts = new Map();
for (const l of listings) {
  const d = (l.description || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!d) continue;
  if (!descCounts.has(d)) descCounts.set(d, []);
  descCounts.get(d).push(l);
}
const dupDescGroups = [...descCounts.entries()].filter(([, group]) => group.length > 1);
console.log(`  ${dupDescGroups.length} distinct description texts are reused across multiple listing_ids.`);
for (const [desc, group] of dupDescGroups.slice(0, 10)) {
  console.log(`\n  Reused ${group.length}x: "${desc.slice(0, 100)}${desc.length > 100 ? "..." : ""}"`);
  console.log("   ", group.map((l) => ({ id: l.listing_id, apartment_name: l.apartment_name, locality: l.locality, price: l.price })));
}
console.log("\n  -> If the SAME description text is glued onto DIFFERENT apartment_name/locality/price");
console.log("     combos, that's strong evidence of fake listings generating enquiries (per the");
console.log("     assignment's own hint: 'a seller can write anything'). A shared phone number alone");
console.log("     is weaker evidence — real agents legitimately post many genuine listings.");

const phoneCounts = new Map();
for (const l of listings) {
  const p = l.posted_by_contact;
  if (!p) continue;
  phoneCounts.set(p, (phoneCounts.get(p) || 0) + 1);
}
const suspiciousPhones = [...phoneCounts.entries()].filter(([, n]) => n > 5).sort((a, b) => b[1] - a[1]);
console.log("\n  (secondary signal) Phone numbers appearing on >5 listings:", suspiciousPhones.slice(0, 10));

// Cross-check: do these phone clusters share one posted_by_name (a shell
// identity), and are their prices suspiciously cheap (the classic enquiry-bait
// pattern)? Compute overall median price/sqft for comparison.
const allPsf = listings.filter((l) => l.__carpet_area_corrected > 0 && l.price > 0).map((l) => l.price / l.__carpet_area_corrected).sort((a, b) => a - b);
const overallMedianPsf = allPsf[Math.floor(allPsf.length / 2)];
console.log(`\n  Overall median price/sqft (all listings, for comparison): ${overallMedianPsf.toFixed(2)}`);
for (const [phone, count] of suspiciousPhones.slice(0, 6)) {
  const group = listings.filter((l) => l.posted_by_contact === phone);
  const names = [...new Set(group.map((l) => l.posted_by_name))];
  const psfs = group.filter((l) => l.__carpet_area_corrected > 0).map((l) => l.price / l.__carpet_area_corrected);
  const avgGroupPsf = psfs.reduce((a, b) => a + b, 0) / (psfs.length || 1);
  console.log(`  ${phone} (n=${count}): posted_by_name(s)=${JSON.stringify(names)}, avg price/sqft=${avgGroupPsf.toFixed(2)} vs overall median ${overallMedianPsf.toFixed(2)}`);
}
console.log("  -> One shared name + a single phone + a big group + notably below-median pricing");
console.log("     together make a strong fake-listing case. A shared phone with normal pricing");
console.log("     and a real-sounding varied history could just be a busy real agent.");

// ---------- Q10: projects_with_wrong_listing_count ----------
const listingsByProjectAll = new Map();
const listingsByProjectLive = new Map();
for (const l of listings) {
  if (!l.project_id) continue;
  listingsByProjectAll.set(l.project_id, (listingsByProjectAll.get(l.project_id) || 0) + 1);
  if (l.is_live === true) listingsByProjectLive.set(l.project_id, (listingsByProjectLive.get(l.project_id) || 0) + 1);
}
let wrongVsAll = 0;
let wrongVsLive = 0;
const wrongExamples = [];
for (const p of projects) {
  const actualAll = listingsByProjectAll.get(p.project_id) || 0;
  const actualLive = listingsByProjectLive.get(p.project_id) || 0;
  if (actualAll !== p.total_listings) wrongVsAll++;
  if (actualLive !== p.total_listings) wrongVsLive++;
  if (actualAll !== p.total_listings || actualLive !== p.total_listings) {
    wrongExamples.push({ project_id: p.project_id, documented: p.total_listings, actual_all: actualAll, actual_live_only: actualLive });
  }
}
console.log(`\nQ10 candidates: wrong vs ALL linked listings = ${wrongVsAll}, wrong vs is_live-only listings = ${wrongVsLive}`);
console.log("  Examples:", wrongExamples.slice(0, 10));
console.log("  -> Whichever comparison (all vs is_live-only) has a MUCH smaller mismatch count is");
console.log("     probably the one the documented counter actually agrees with — use that count.");
console.log("     If both are high, total_listings may just be broadly unreliable (a real finding).");

console.log("\n--- Done. Everything under [DIAGNOSTIC] needs your judgment before it goes in submission.json. ---");
