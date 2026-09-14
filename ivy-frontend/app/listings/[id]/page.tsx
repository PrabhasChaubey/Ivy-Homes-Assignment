// app/listings/[id]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRequireAuth, useAuth } from "@/lib/auth-context";
import { getAllListings } from "@/lib/data";
import { formatINR } from "@/lib/data";
import { isFavourite, addFavouriteLocal, removeFavouriteLocal } from "@/lib/favourites";

export default function ListingDetailPage() {
  useRequireAuth();
  const { email } = useAuth();
  const params = useParams();
  const id = params.id as string;
  const [listing, setListing] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getAllListings()
      .then((listings) => {
        const found = listings.find(
          (l) => l.listing_id === id
        );

        if (!found) {
          setError("Listing not found");
          return;
        }

        setListing(found);
      })
      .catch((e) => setError(String(e)));
  }, [id]);

  useEffect(() => {
    if (email) setSaved(isFavourite(email, id));
  }, [email, id]);

  function toggleSave() {
    if (!email) return;
    if (saved) {
      removeFavouriteLocal(email, id);
      setSaved(false);
    } else {
      addFavouriteLocal(email, id);
      setSaved(true);
    }
  }

  if (error) return <p className="text-red-600">{error}</p>;
  if (!listing) return <p>Loading...</p>;

  return (
    <div className="bg-white border rounded p-6 max-w-2xl">
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-bold">{listing.apartment_name}</h1>
        <button onClick={toggleSave} className="px-3 py-1 border rounded text-sm">
          {saved ? "★ Saved" : "☆ Save"}
        </button>
      </div>
      <p className="text-gray-600">{listing.locality} · {listing.property_type}</p>
      <p className="text-xl font-semibold mt-2">{formatINR(listing.price)}</p>
      <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
        <div>Bedrooms: {listing.bedroom}</div>
        <div>Bathrooms: {listing.bathroom}</div>
        <div>Carpet area: {listing.carpet_area} sqft</div>
        <div>Super built-up: {listing.super_built_up_area} sqft</div>
        <div>Floor: {listing.floor} / {listing.total_floors}</div>
        <div>Furnishing: {listing.furnishing}</div>
        <div>Facing: {listing.facing_direction}</div>
        <div>Parking: {listing.covered_parking}</div>
      </div>
      <p className="mt-4 text-sm text-gray-700">{listing.description}</p>
      <div className="mt-4 text-sm text-gray-600">
        Posted by {listing.posted_by_name} ({listing.posted_by}) · {listing.posted_by_contact}
      </div>
    </div>
  );
}
