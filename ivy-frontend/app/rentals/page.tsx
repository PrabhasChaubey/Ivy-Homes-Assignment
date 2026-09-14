// app/rentals/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRequireAuth } from "@/lib/auth-context";
import { getAllRentals, formatINR } from "@/lib/data";

const PAGE_SIZE = 20;

export default function RentalsPage() {
  useRequireAuth();
  const [all, setAll] = useState<any[] | null>(null);
  const [locality, setLocality] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    getAllRentals().then(setAll);
  }, []);

  const localities = useMemo(() => [...new Set((all || []).map((r) => r.locality))].sort(), [all]);
  const filtered = useMemo(() => (all || []).filter((r) => !locality || r.locality === locality), [all, locality]);
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  if (!all) return <p>Loading rentals...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Rentals ({filtered.length})</h1>
      <select value={locality} onChange={(e) => { setLocality(e.target.value); setPage(1); }} className="border rounded px-2 py-1 mb-4">
        <option value="">All localities</option>
        {localities.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>
      <div className="grid gap-3">
        {pageItems.map((r) => (
          <div key={r.listing_id} className="bg-white border rounded p-3">
            <div className="font-semibold">{r.title} — {r.locality}</div>
            <div className="text-sm text-gray-600">
              {r.bedroom} BHK · {r.carpet_area} sqft · {formatINR(r.price)}/mo · Deposit {formatINR(r.deposit)}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-4 items-center">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
        <span>Page {page} of {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
      </div>
    </div>
  );
}
