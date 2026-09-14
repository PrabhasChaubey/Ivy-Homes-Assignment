// test-pagination.mjs
// 'page' is confirmed to do nothing. This tries several plausible real
// pagination mechanisms against /v1/listings and reports the first/last
// listing_id for each, so we can see empirically which one actually moves
// the window instead of guessing.
//
// Run AFTER logging in once (reuses the same login as fetch-data.mjs).
// Run: node test-pagination.mjs
import dotenv from "dotenv";
dotenv.config();

const BASE_URL = process.env.IVY_BASE_URL;
const API_KEY = process.env.IVY_API_KEY;
const LOGIN_EMAIL = process.env.IVY_EMAIL;
const LOGIN_PASSWORD = process.env.IVY_PASSWORD;

async function login() {
  const res = await fetch(new URL("/auth/login", BASE_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
    body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`login failed: ${JSON.stringify(body)}`);
  return body.access_token || body.token;
}

async function probe(token, label, params) {
  const url = new URL("/v1/listings", BASE_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url, {
      headers: { "X-API-Key": API_KEY, Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    if (!res.ok) {
      console.log(`${label.padEnd(28)} -> ${res.status} ${JSON.stringify(body).slice(0, 120)}`);
      return;
    }
    const first = body.results?.[0]?.listing_id;
    const last = body.results?.[body.results.length - 1]?.listing_id;
    console.log(`${label.padEnd(28)} -> total=${body.total} page=${body.page} page_size=${body.page_size} count=${body.results?.length} first=${first} last=${last}`);
  } catch (e) {
    console.log(`${label.padEnd(28)} -> ERROR ${e.message}`);
  }
}

async function main() {
  const token = await login();
  console.log("Baseline (page=1) then a battery of alternate pagination params:\n");

  await probe(token, "page=1", { page: 1 });
  await probe(token, "page=2", { page: 2 });
  await probe(token, "offset=50", { offset: 50 });
  await probe(token, "offset=50&limit=50", { offset: 50, limit: 50 });
  await probe(token, "skip=50", { skip: 50 });
  await probe(token, "start=50", { start: 50 });
  await probe(token, "from=50", { from: 50 });
  await probe(token, "page=0", { page: 0 });
  await probe(token, "page=2&limit=50", { page: 2, limit: 50 });
  await probe(token, "page=2&page_size=50", { page: 2, page_size: 50 });
  await probe(token, "page_number=2", { page_number: 2 });
  await probe(token, "cursor=50", { cursor: 50 });
  await probe(token, "limit=200 (no page)", { limit: 200 });

  console.log("\nWhichever line above shows a DIFFERENT first/last id than the page=1");
  console.log("baseline is the real pagination mechanism. Paste this whole output back.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
