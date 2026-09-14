// app/saved/page.tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth, useAuth } from "@/lib/auth-context";
import { getAllListings, formatINR } from "@/lib/data";
import { getFavouriteIds, removeFavouriteLocal } from "@/lib/favourites";

export default function SavedPage() {
  useRequireAuth();
  const { email } = useAuth();
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!email) return;
    getAllListings()
      .then((all) => {
        const ids = new Set(getFavouriteIds(email));
        setItems(all.filter((l) => ids.has(l.listing_id)));
      })
      .catch((e) => setError(e.message || "Failed to load saved listings"));
  }, [email]);

  function remove(id: string) {
    if (!email) return;
    removeFavouriteLocal(email, id);
    setItems((prev) => (prev || []).filter((l) => l.listing_id !== id));
  }

  if (error) return (
    <div>
      <p className="text-red-600 mb-2">{error}</p>
      <Link href="/login" className="underline">Log in again</Link>
    </div>
  );
  if (!items) return <p>Loading...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Saved listings ({items.length})</h1>
      <div className="grid gap-3">
        {items.map((l) => (
          <div key={l.listing_id} className="bg-white border rounded p-3 flex justify-between items-center">
            <Link href={`/listings/${l.listing_id}`} className="flex-1">
              <div className="font-semibold">{l.apartment_name} — {l.locality}</div>
              <div className="text-sm text-gray-600">{l.bedroom} BHK · {formatINR(l.price)}</div>
            </Link>
            <button onClick={() => remove(l.listing_id)} className="ml-3 px-3 py-1 border rounded text-sm">Remove</button>
          </div>
        ))}
        {items.length === 0 && <p className="text-gray-500">Nothing saved yet.</p>}
      </div>
    </div>
  );
}
