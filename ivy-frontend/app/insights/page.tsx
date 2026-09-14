// app/insights/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRequireAuth } from "@/lib/auth-context";
import { getAllListings, getAllProjects, getAnalytics, correctProjectPrice, formatINR } from "@/lib/data";

export default function InsightsPage() {
  useRequireAuth();
  const [analytics, setAnalytics] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [listings, projects, summary] = await Promise.all([getAllListings(), getAllProjects(), getAnalytics()]);
        const active = listings.filter((l) => l.is_live === true);
        const inactive = listings.length - active.length;

        const costliest = projects.reduce((best: any, p: any) => (p.price_max > (best?.price_max ?? -Infinity) ? p : best), null);

        setAnalytics(summary);
        setStats({
          totalListings: listings.length,
          activeListings: active.length,
          inactiveListings: inactive,
          totalProjects: projects.length,
          costliestProject: costliest,
        });
      } catch (e: any) {
        setError(e.message || "Failed to load insights");
      }
    })();
  }, []);

  if (error) return (
    <div>
      <p className="text-red-600 mb-2">{error}</p>
      <a href="/login" className="underline">Log in again</a>
    </div>
  );
  if (!analytics || !stats) return <p>Loading insights...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Insights</h1>

      <section className="bg-white border rounded p-4">
        <h2 className="font-semibold mb-2">City summary (from /v1/analytics/summary)</h2>
        <p>City: {analytics.city}</p>
        <p>Median price: {formatINR(analytics.median_price)}</p>
        <p>Median price/sqft: {formatINR(analytics.median_price_per_sqft)}</p>
      </section>

      <section className="bg-white border rounded p-4">
        <h2 className="font-semibold mb-2">What the raw data actually shows</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>{stats.totalListings} total listing records retrievable (the documented `total` field undercounts this — see findings)</li>
          <li>{stats.activeListings} are actually live (`is_live: true`); {stats.inactiveListings} inactive listings are still returned by the endpoint despite docs claiming only active listings are served</li>
          <li>{stats.totalProjects} builder projects tracked</li>
          {stats.costliestProject && (
            <li>
              Most expensive project: {stats.costliestProject.apartment_name} at{" "}
              {formatINR(correctProjectPrice(stats.costliestProject.price_max))}{" "}
              (raw field says {stats.costliestProject.price_max} — recorded in crores, not rupees, despite documentation)
            </li>
          )}
        </ul>
      </section>

      <section className="bg-white border rounded p-4">
        <h2 className="font-semibold mb-2">By locality (from /v1/analytics/summary)</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left"><th>Locality</th><th>Count</th><th>Median price</th></tr></thead>
          <tbody>
            {(analytics.by_locality || []).map((l: any) => (
              <tr key={l.locality}><td>{l.locality}</td><td>{l.count}</td><td>{formatINR(l.median_price)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
