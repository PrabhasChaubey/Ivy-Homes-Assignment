// components/NavBar.tsx
"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function NavBar() {
  const { email, logout } = useAuth();
  return (
    <nav className="bg-white border-b px-4 py-3 flex items-center gap-4 flex-wrap">
      <span className="font-bold">Ivy Homes</span>
      <Link href="/listings">Listings</Link>
      <Link href="/rentals">Rentals</Link>
      <Link href="/projects">Projects</Link>
      <Link href="/saved">Saved</Link>
      <Link href="/insights">Insights</Link>
      <span className="ml-auto text-sm text-gray-600">
        {email ? (
          <>
            {email} · <button onClick={logout} className="underline">Log out</button>
          </>
        ) : (
          <Link href="/login">Log in</Link>
        )}
      </span>
    </nav>
  );
}
