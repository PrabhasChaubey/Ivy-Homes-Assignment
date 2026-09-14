// test-analytics.mjs
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

  const paths = [
    "/v1/analytics/summary",
    "/analytics/summary",
    "/v1/analytics",
    "/v1/summary",
    "/v1/stats",
    "/v1/analytics/summary/",
  ];
  for (const path of paths) {
    const res = await fetch(new URL(path, BASE_URL), { headers });
    const body = await res.json().catch(() => ({}));
    console.log(`${path.padEnd(28)} -> ${res.status} ${JSON.stringify(body).slice(0, 150)}`);
  }
}

main().catch(console.error);
