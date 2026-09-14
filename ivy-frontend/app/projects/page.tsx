// app/projects/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRequireAuth } from "@/lib/auth-context";
import { getAllProjects, correctProjectPrice, formatINR } from "@/lib/data";

export default function ProjectsPage() {
  useRequireAuth();
  const [projects, setProjects] = useState<any[] | null>(null);

  useEffect(() => {
    getAllProjects().then(setProjects);
  }, []);

  if (!projects) return <p>Loading projects...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Projects ({projects.length})</h1>
      <div className="grid gap-3">
        {projects.map((p) => (
          <div key={p.project_id} className="bg-white border rounded p-3">
            <div className="font-semibold">{p.apartment_name} — {p.developer_name}</div>
            <div className="text-sm text-gray-600">
              {p.locality} · {p.project_status} · {p.total_units} units
            </div>
            {/* price_min/price_max are recorded in crores despite the docs
                claiming rupees — corrected here, see findings */}
            <div className="text-sm mt-1">
              {formatINR(correctProjectPrice(p.price_min))} – {formatINR(correctProjectPrice(p.price_max))}
            </div>
            <div className="text-xs text-gray-500">{p.min_area_sqft}–{p.max_area_sqft} sqft · {p.total_listings} listings</div>
          </div>
        ))}
      </div>
    </div>
  );
}
