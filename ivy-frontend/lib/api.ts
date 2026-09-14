// lib/api.ts
// Client for the Ivy Homes API, built from empirically-confirmed behavior
// (NOT the docs, which are wrong in several places — see README/findings):
//   - API key goes in the X-API-Key header, not ?api_key= (docs say query param)
//   - /auth/login ALSO requires X-API-Key (docs don't mention this)
//   - Login response field is `access_token`, not `token`; there IS a
//     `refresh_token` + `refresh_url` (docs say "no refresh flow")
//   - Token expires in ~900s (15 min), not 24h as documented — MUST refresh
//     to satisfy the "still working 30 min later" requirement
//   - Pagination is offset-based (`offset`), not `page` (page is a no-op)
//   - Real page cap is 50 records, not the documented 200
//   - `total` in list responses undercounts the real retrievable set — don't
//     use it as a stopping condition, only an empty page means "done"

const BASE_URL = process.env.NEXT_PUBLIC_IVY_BASE_URL || "https://solve.ivy.homes";
const API_KEY = process.env.NEXT_PUBLIC_IVY_API_KEY || "";

type Tokens = { accessToken: string; refreshToken: string; expiresAt: number };

let tokens: Tokens | null = null;
const TOKEN_STORAGE_KEY = "ivy_tokens";

function loadTokens(): Tokens | null {
  if (tokens) return tokens;
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) return null;
  tokens = JSON.parse(raw);
  return tokens;
}

function saveTokens(t: Tokens) {
  tokens = t;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(t));
  }
}

export function clearTokens() {
  tokens = null;
  if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function isLoggedIn(): boolean {
  return !!loadTokens();
}

export async function login(email: string, password: string) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Login failed");
  const body = await res.json();
  saveTokens({
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    // refresh a bit early (60s buffer) rather than right at expiry
    expiresAt: Date.now() + (body.expires_in - 60) * 1000,
  });
  return body.user;
}

async function refresh(): Promise<boolean> {
  const t = loadTokens();
  if (!t) return false;
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
    body: JSON.stringify({ refresh_token: t.refreshToken }),
  });
  if (!res.ok) {
    clearTokens();
    return false;
  }
  const body = await res.json();
  saveTokens({
    accessToken: body.access_token,
    refreshToken: body.refresh_token || t.refreshToken,
    expiresAt: Date.now() + (body.expires_in - 60) * 1000,
  });
  return true;
}

async function ensureFreshToken() {
  const t = loadTokens();
  if (!t) throw new Error("Not logged in");
  if (Date.now() >= t.expiresAt) {
    const ok = await refresh();
    if (!ok) throw new Error("Session expired, please log in again");
  }
}

async function apiFetch(path: string, params: Record<string, string | number | undefined> = {}) {
  await ensureFreshToken();
  const t = loadTokens()!;
  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    headers: { "X-API-Key": API_KEY, Authorization: `Bearer ${t.accessToken}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

// Fetches ONE page at a real offset — use this for UI pagination/infinite scroll.
export async function fetchListingsPage(params: {
  offset?: number;
  limit?: number;
  locality?: string;
  bhk?: number;
  property_type?: string;
  min_price?: number;
  max_price?: number;
  furnishing?: string;
  sort_by?: string;
  order?: string;
}) {
  return apiFetch("/v1/listings", { limit: 50, ...params });
}

export async function fetchListing(id: string) {
  return apiFetch(`/v1/listing/${id}`);
}

export async function fetchRentalsPage(params: Record<string, string | number | undefined> = {}) {
  return apiFetch("/v1/rentals", { limit: 50, ...params });
}

export async function fetchProjectsPage(params: Record<string, string | number | undefined> = {}) {
  return apiFetch("/v1/projects", { limit: 50, ...params });
}

export async function fetchAnalyticsSummary() {
  return apiFetch("/v1/analytics/summary");
}

export async function fetchFavourites() {
  return apiFetch("/v1/favourites");
}

export async function addFavourite(listingId: string) {
  await ensureFreshToken();
  const t = loadTokens()!;
  const res = await fetch(`${BASE_URL}/v1/favourites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": API_KEY, Authorization: `Bearer ${t.accessToken}` },
    body: JSON.stringify({ id: listingId }),
  });
  if (!res.ok) throw new Error("Failed to add favourite");
}

export async function removeFavourite(listingId: string) {
  await ensureFreshToken();
  const t = loadTokens()!;
  const res = await fetch(`${BASE_URL}/v1/favourites/${listingId}`, {
    method: "DELETE",
    headers: { "X-API-Key": API_KEY, Authorization: `Bearer ${t.accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to remove favourite");
}

// Fetches every page for a collection, WITHOUT trusting `total` as a stop
// condition (confirmed unreliable) — stops only on a genuinely empty page.
export async function fetchAllPages(
  fetchPageFn: (params: any) => Promise<any>,
  extraParams: Record<string, any> = {}
) {
  const results: any[] = [];
  let offset = 0;
  while (true) {
    const body = await fetchPageFn({ ...extraParams, offset, limit: 50 });
    if (!body.results || body.results.length === 0) break;
    results.push(...body.results);
    offset += body.results.length;
    if (offset > 20000) break; // safety cap
  }
  return results;
}
