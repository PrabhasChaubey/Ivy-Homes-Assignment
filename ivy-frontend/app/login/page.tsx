// app/login/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("demo1@ivy.homes");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/listings");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16 bg-white p-6 rounded-lg shadow">
      <h1 className="text-xl font-bold mb-4">Log in</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Account</label>
          <select value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded px-2 py-1">
            <option value="demo1@ivy.homes">demo1@ivy.homes</option>
            <option value="demo2@ivy.homes">demo2@ivy.homes</option>
            <option value="demo3@ivy.homes">demo3@ivy.homes</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded px-2 py-1"
            required
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button disabled={loading} className="w-full bg-black text-white rounded py-2 disabled:opacity-50">
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>
    </div>
  );
}
