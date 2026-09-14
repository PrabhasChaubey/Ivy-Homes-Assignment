// fetch-data.mjs
// Pulls the full dataset from the Ivy Homes API and dumps it to ./data/*.json
// Requires Node 18+ (built-in fetch). Run: node fetch-data.mjs
//
// IMPORTANT: don't commit this file with your real key hardcoded to a public
// repo. Use an env var or a .env (gitignored) for the actual submission repo.
import dotenv from "dotenv";
dotenv.config();

const BASE_URL = process.env.IVY_BASE_URL;
const API_KEY = process.env.IVY_API_KEY;
const LIMIT = 200; // max per docs

const LOGIN_EMAIL = process.env.IVY_EMAIL;
const LOGIN_PASSWORD = process.env.IVY_PASSWORD;

import { mkdir, writeFile } from "node:fs/promises";

let AUTH_TOKEN = null;

async function login() {
  const res = await fetch(new URL("/auth/login", BASE_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
    body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`POST /auth/login -> ${res.status}: ${JSON.stringify(body)}`);
  console.log("Raw /auth/login response:", JSON.stringify(body, null, 2));
  AUTH_TOKEN = body.token || body.access_token || body.auth_token || body.jwt || body.id_token;
  console.log(`Logged in as ${LOGIN_EMAIL}. Token expires_in: ${body.expires_in}s. Token captured: ${AUTH_TOKEN ? "yes" : "NO - check raw response above"}`);
  return body;
}

async function getJSON(path, params = {}) {
  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }
  // NOTE: the docs say to send the key as ?api_key=..., but the API actually
  // requires it as an X-API-Key header (confirmed via a 401 with that exact
  // message) — this is itself a documentation finding, see chat.
  const headers = { "X-API-Key": API_KEY };
  if (AUTH_TOKEN) headers["Authorization"] = `Bearer ${AUTH_TOKEN}`;
  const res = await fetch(url, { headers });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`GET ${url} -> ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

// The docs claim page-based pagination with `page`/`limit` up to 200.
// CONFIRMED via test-pagination.mjs that `page` is silently ignored and the
// real mechanism is `offset`, and the real per-page cap is 50 regardless of
// requested `limit`. This walks offset forward by however many records the
// server actually returned each time (robust to the cap being anything).
async function fetchAll(path, extraParams = {}) {
  const results = [];
  let offset = 0;
  let total = null;
  const seenTotals = new Set();

  while (true) {
    const body = await getJSON(path, { ...extraParams, offset, limit: LIMIT });
    if (total === null) total = body.total;
    seenTotals.add(body.total);

    if (!Array.isArray(body.results)) {
      console.warn(`  [!] offset ${offset}: no "results" array — got:`, Object.keys(body));
      break;
    }

    results.push(...body.results);
    const firstId = body.results[0]?.listing_id ?? body.results[0]?.project_id ?? "?";
    const lastId = body.results[body.results.length - 1]?.listing_id ?? body.results[body.results.length - 1]?.project_id ?? "?";
    console.log(`  ${path} offset ${offset}: +${body.results.length} (running total ${results.length}/${body.total}) [first=${firstId} last=${lastId}]`);

    if (body.results.length === 0) break;
    offset += body.results.length;
    if (offset > 20000) {
      console.warn("  [!] safety stop at offset 20000 — investigate pagination");
      break;
    }
  }

  if (results.length !== total) {
    console.warn(`  [!] MISMATCH: declared total=${total} but actually paged ${results.length} records (stopped only on an empty page — total is not trustworthy)`);
  }

  if (seenTotals.size > 1) {
    console.warn(`  [!] "total" for ${path} was not stable across requests: ${[...seenTotals].join(", ")}`);
  }

  // de-dup check: do we actually have `total` distinct records, or did the
  // server hand us repeats?
  return { declaredTotal: total, results };
}

async function main() {
  await mkdir("./data", { recursive: true });

  await login();

  console.log("Fetching /health ...");
  const health = await getJSON("/health").catch((e) => ({ error: String(e) }));
  console.log(health);

  console.log("\nFetching /v1/listings (all pages) ...");
  const listings = await fetchAll("/v1/listings");
  console.log(`  -> declared total: ${listings.declaredTotal}, actually retrieved: ${listings.results.length}`);

  console.log("\nFetching /v1/rentals (all pages) ...");
  const rentals = await fetchAll("/v1/rentals");
  console.log(`  -> declared total: ${rentals.declaredTotal}, actually retrieved: ${rentals.results.length}`);

  console.log("\nFetching /v1/projects (all pages) ...");
  const projects = await fetchAll("/v1/projects");
  console.log(`  -> declared total: ${projects.declaredTotal}, actually retrieved: ${projects.results.length}`);

  console.log("\nFetching /v1/analytics/summary ...");
  const analytics = await getJSON("/v1/analytics/summary").catch((e) => ({ error: String(e) }));

  // Sanity checks worth doing right here, cheaply:
  const listingIds = listings.results.map((l) => l.listing_id);
  const dupIds = listingIds.filter((id, i) => listingIds.indexOf(id) !== i);
  if (dupIds.length) console.warn(`\n[!] duplicate listing_ids within /v1/listings itself: ${dupIds.length}`, [...new Set(dupIds)].slice(0, 10));

  const fieldsSeen = new Set();
  for (const l of listings.results) Object.keys(l).forEach((k) => fieldsSeen.add(k));
  console.log("\nAll fields ever seen on a listing object:", [...fieldsSeen].sort());

  await writeFile("./data/health.json", JSON.stringify(health, null, 2));
  await writeFile("./data/listings.json", JSON.stringify(listings.results, null, 2));
  await writeFile("./data/rentals.json", JSON.stringify(rentals.results, null, 2));
  await writeFile("./data/projects.json", JSON.stringify(projects.results, null, 2));
  await writeFile("./data/analytics.json", JSON.stringify(analytics, null, 2));
  await writeFile(
    "./data/meta.json",
    JSON.stringify(
      {
        fetched_at: new Date().toISOString(),
        counts: {
          listings: listings.results.length,
          rentals: rentals.results.length,
          projects: projects.results.length,
        },
        declared_totals: {
          listings: listings.declaredTotal,
          rentals: rentals.declaredTotal,
          projects: projects.declaredTotal,
        },
      },
      null,
      2
    )
  );

  console.log("\nDone. Data written to ./data/*.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
