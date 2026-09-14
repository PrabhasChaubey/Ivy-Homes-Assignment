// test-refresh.mjs
// Confirms the real shape of POST /auth/refresh before we trust it in the app.
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
  const loginBody = await login();
  console.log("Login OK, refresh_token:", loginBody.refresh_token?.slice(0, 20) + "...");

  // Try a few plausible request shapes for /auth/refresh
  const attempts = [
    { label: "body: {refresh_token}", body: { refresh_token: loginBody.refresh_token } },
    { label: "body: {token: refresh_token}", body: { token: loginBody.refresh_token } },
  ];

  for (const attempt of attempts) {
    const res = await fetch(new URL("/auth/refresh", BASE_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
      body: JSON.stringify(attempt.body),
    });
    const body = await res.json().catch(() => ({}));
    console.log(`\n${attempt.label} -> ${res.status}:`, JSON.stringify(body, null, 2));
    if (res.ok) {
      console.log("^^^ THIS SHAPE WORKED. Use this request format in lib/api.ts's refresh().");
      break;
    }
  }

  // Also try it as a Bearer-authenticated call with no body, in case that's the real contract
  const res2 = await fetch(new URL("/auth/refresh", BASE_URL), {
    method: "POST",
    headers: { "X-API-Key": API_KEY, Authorization: `Bearer ${loginBody.refresh_token}` },
  });
  const body2 = await res2.json().catch(() => ({}));
  console.log(`\nBearer refresh_token, no body -> ${res2.status}:`, JSON.stringify(body2, null, 2));
}

main().catch((e) => console.error(e));
