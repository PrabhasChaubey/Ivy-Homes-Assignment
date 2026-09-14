// lib/auth-context.tsx
"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { login as apiLogin, isLoggedIn, clearTokens } from "./api";

type AuthState = { email: string | null; ready: boolean };
const AuthContext = createContext<AuthState & {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}>({ email: null, ready: false, login: async () => {}, logout: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) {
      setEmail(window.localStorage.getItem("ivy_user_email"));
    }
    setReady(true);
  }, []);

  async function login(e: string, password: string) {
    const user = await apiLogin(e, password);
    window.localStorage.setItem("ivy_user_email", user.email);
    setEmail(user.email);
  }

  function logout() {
    clearTokens();
    window.localStorage.removeItem("ivy_user_email");
    setEmail(null);
  }

  return <AuthContext.Provider value={{ email, ready, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

// Call at the top of any protected page's component body.
export function useRequireAuth() {
  const { email, ready } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (ready && !email && !isLoggedIn()) router.replace("/login");
  }, [ready, email, router]);
}
