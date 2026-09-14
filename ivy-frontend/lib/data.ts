// lib/data.ts

// Pull full collections once per session.
// Filtering, sorting and pagination happen client-side.

import {
  fetchAllPages,
  fetchListingsPage,
  fetchRentalsPage,
  fetchProjectsPage,
} from "./api";

let listingsCache: any[] | null = null;
let rentalsCache: any[] | null = null;
let projectsCache: any[] | null = null;

export async function getAllListings(): Promise<any[]> {
  if (!listingsCache) {
    listingsCache = await fetchAllPages(fetchListingsPage);
  }

  return listingsCache;
}

export async function getAllRentals(): Promise<any[]> {
  if (!rentalsCache) {
    rentalsCache = await fetchAllPages(fetchRentalsPage);
  }

  return rentalsCache;
}

export async function getAllProjects(): Promise<any[]> {
  if (!projectsCache) {
    projectsCache = await fetchAllPages(fetchProjectsPage);
  }

  return projectsCache;
}

// ---------------------------------------------------------
// Analytics
// ---------------------------------------------------------

function median(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function medianPricePerSqft(listings: any[]): number {
  const values = listings
    .filter(
      (listing) =>
        typeof listing.price === "number" &&
        typeof listing.carpet_area === "number" &&
        listing.carpet_area > 0
    )
    .map((listing) => listing.price / listing.carpet_area);

  return median(values);
}

export async function getAnalytics() {
  const allListings = await getAllListings();

  // Analytics should represent currently live listings.
  const liveListings = allListings.filter(
    (listing) => listing.is_live === true
  );

  // Total listings
  const totalListings = liveListings.length;

  // Median sale price
  const medianPrice = median(
    liveListings
      .filter((listing) => typeof listing.price === "number")
      .map((listing) => listing.price)
  );

  // Median price per square foot
  const medianPsf = medianPricePerSqft(liveListings);

  // -------------------------------------------------------
  // By locality
  // -------------------------------------------------------

  const localityMap = new Map<
    string,
    {
      count: number;
      prices: number[];
    }
  >();

  for (const listing of liveListings) {
    const locality = listing.locality || "unknown";

    if (!localityMap.has(locality)) {
      localityMap.set(locality, {
        count: 0,
        prices: [],
      });
    }

    const entry = localityMap.get(locality)!;

    entry.count += 1;

    if (typeof listing.price === "number") {
      entry.prices.push(listing.price);
    }
  }

  const byLocality = [...localityMap.entries()]
    .map(([locality, data]) => ({
      locality,
      count: data.count,
      median_price: median(data.prices),
    }))
    .sort((a, b) => b.count - a.count);

  // -------------------------------------------------------
  // By BHK
  // -------------------------------------------------------

  const bhkMap = new Map<number, number>();

  for (const listing of liveListings) {
    if (typeof listing.bedroom !== "number") continue;

    bhkMap.set(
      listing.bedroom,
      (bhkMap.get(listing.bedroom) || 0) + 1
    );
  }

  const byBhk = [...bhkMap.entries()]
    .map(([bedroom, count]) => ({
      bedroom,
      count,
    }))
    .sort((a, b) => a.bedroom - b.bedroom);

  return {
    city: "chennai",
    total_listings: totalListings,
    median_price: medianPrice,
    median_price_per_sqft: medianPsf,
    by_locality: byLocality,
    by_bhk: byBhk,
  };
}

// ---------------------------------------------------------
// Project price correction
// ---------------------------------------------------------

// Project price_min / price_max are stored in crores.
// Convert crore values to INR.

export function correctProjectPrice(rawCroreValue: number): number {
  return Math.round(rawCroreValue * 1e7);
}

export function formatINR(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}