// app/listings/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRequireAuth, useAuth } from "@/lib/auth-context";
import { getAllListings, formatINR } from "@/lib/data";
import { getFavouriteIds, addFavouriteLocal, removeFavouriteLocal } from "@/lib/favourites";

const PAGE_SIZE = 20;

export default function ListingsPage() {
  useRequireAuth();
  const { email } = useAuth();
  const [all, setAll] = useState<any[] | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [locality, setLocality] = useState("");
  const [bhk, setBhk] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [furnishing, setFurnishing] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllListings().then((data) => {
      // only show is_live=true — the endpoint claims to but doesn't always,
      // so we filter it ourselves (see findings)
      setAll(data.filter((l) => l.is_live === true));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (email) setSavedIds(new Set(getFavouriteIds(email)));
  }, [email]);

  const localities = useMemo(() => [...new Set((all || []).map((l) => l.locality))].sort(), [all]);

  const filtered = useMemo(() => {
    if (!all) return [];
    return all.filter((l) => {
      if (locality && l.locality !== locality) return false;
      if (bhk && l.bedroom !== Number(bhk)) return false;
      if (minPrice && l.price < Number(minPrice)) return false;
      if (maxPrice && l.price > Number(maxPrice)) return false;
      if (furnishing && l.furnishing !== furnishing) return false;
      return true;
    });
  }, [all, locality, bhk, minPrice, maxPrice, furnishing]);

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  function toggleSave(id: string) {
    if (!email) return;
    if (savedIds.has(id)) {
      removeFavouriteLocal(email, id);
      setSavedIds((s) => new Set([...s].filter((x) => x !== id)));
    } else {
      addFavouriteLocal(email, id);
      setSavedIds((s) => new Set([...s, id]));
    }
  }

  if (loading) return <p>Loading listings...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Listings ({filtered.length})</h1>
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={locality} onChange={(e) => { setLocality(e.target.value); setPage(1); }} className="border rounded px-2 py-1">
          <option value="">All localities</option>
          {localities.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={bhk} onChange={(e) => { setBhk(e.target.value); setPage(1); }} className="border rounded px-2 py-1">
          <option value="">Any BHK</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} BHK</option>)}
        </select>
        <input placeholder="Min price" type="number" value={minPrice} onChange={(e) => { setMinPrice(e.target.value); setPage(1); }} className="border rounded px-2 py-1 w-32" />
        <input placeholder="Max price" type="number" value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }} className="border rounded px-2 py-1 w-32" />
        <select value={furnishing} onChange={(e) => { setFurnishing(e.target.value); setPage(1); }} className="border rounded px-2 py-1">
          <option value="">Any furnishing</option>
          <option value="unfurnished">Unfurnished</option>
          <option value="semi-furnished">Semi-furnished</option>
          <option value="fully-furnished">Fully-furnished</option>
        </select>
      </div>

      <div className="grid gap-3">
        {pageItems.map((l) => (
          <div key={l.listing_id} className="bg-white border rounded p-3 flex justify-between items-center">
            <Link href={`/listings/${l.listing_id}`} className="flex-1">
              <div className="font-semibold">{l.apartment_name} — {l.locality}</div>
              <div className="text-sm text-gray-600">{l.bedroom} BHK · {l.carpet_area} sqft · {formatINR(l.price)}</div>
            </Link>
            <button onClick={() => toggleSave(l.listing_id)} className="ml-3 px-3 py-1 border rounded text-sm">
              {savedIds.has(l.listing_id) ? "★ Saved" : "☆ Save"}
            </button>
          </div>
        ))}
        {pageItems.length === 0 && <p className="text-gray-500">No listings match these filters.</p>}
      </div>

      <div className="flex gap-2 mt-4 items-center">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
        <span>Page {page} of {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
      </div>
    </div>
  );
}
