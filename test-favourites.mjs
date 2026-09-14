// test-favourites.mjs
import dotenv from "dotenv";
dotenv.config();

const BASE_URL = process.env.IVY_BASE_URL;
const API_KEY = process.env.IVY_API_KEY;

async function login() {
  const res = await fetch(new URL("/auth/login", BASE_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
    body: JSON.stringify({ email: process.env.IVY_EMAIL, password: process.env.IVY_PASSWORD }),
  });
  return res.json();
}

async function main() {
  const { access_token } = await login();
  const headers = { "X-API-Key": API_KEY, Authorization: `Bearer ${access_token}` };

  console.log("GET /v1/favourites ...");
  let res = await fetch(new URL("/v1/favourites", BASE_URL), { headers });
  console.log(res.status, JSON.stringify(await res.json().catch(() => ({}))));

  console.log("\nGET /favourites (no /v1 prefix) ...");
  res = await fetch(new URL("/favourites", BASE_URL), { headers });
  console.log(res.status, JSON.stringify(await res.json().catch(() => ({}))));

  console.log("\nGET /v1/favorites (US spelling) ...");
  res = await fetch(new URL("/v1/favorites", BASE_URL), { headers });
  console.log(res.status, JSON.stringify(await res.json().catch(() => ({}))));

  console.log("\nPOST /v1/favourites with a known listing_id ...");
  res = await fetch(new URL("/v1/favourites", BASE_URL), {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ id: "100-4000397" }),
  });
  console.log(res.status, JSON.stringify(await res.json().catch(() => ({}))));

  console.log("\nGET /v1/favourites again after POST ...");
  res = await fetch(new URL("/v1/favourites", BASE_URL), { headers });
  console.log(res.status, JSON.stringify(await res.json().catch(() => ({}))));
}

main().catch(console.error);
