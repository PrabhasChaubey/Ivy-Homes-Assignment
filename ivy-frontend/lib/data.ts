// lib/data.ts
// Pulls full collections ONCE per session and caches in memory. Filtering,
// sorting, and pagination happen CLIENT-SIDE against this cache — this
// guarantees filters "actually filter... whether or not the server helps
// you" (server-side filter params are unverified) and matches the
// assignment's own advice to pull the dataset down once rather than page
// through it repeatedly.
import { fetchAllPages, fetchListingsPage, fetchRentalsPage, fetchProjectsPage, fetchAnalyticsSummary } from "./api";

let listingsCache: any[] | null = null;
let rentalsCache: any[] | null = null;
let projectsCache: any[] | null = null;

export async function getAllListings(): Promise<any[]> {
  if (!listingsCache) listingsCache = await fetchAllPages(fetchListingsPage);
  return listingsCache;
}

export async function getAllRentals(): Promise<any[]> {
  if (!rentalsCache) rentalsCache = await fetchAllPages(fetchRentalsPage);
  return rentalsCache;
}

export async function getAllProjects(): Promise<any[]> {
  if (!projectsCache) projectsCache = await fetchAllPages(fetchProjectsPage);
  return projectsCache;
}

export async function getAnalytics() {
  return fetchAnalyticsSummary();
}

// CONFIRMED: project price_min/price_max are recorded in crores, not rupees
// as documented (median raw value ~1.87; real median project price cannot
// be ₹1.87). Multiply by 1e7 to get real rupees.
export function correctProjectPrice(rawCroreValue: number): number {
  return Math.round(rawCroreValue * 1e7);
}

export function formatINR(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}
