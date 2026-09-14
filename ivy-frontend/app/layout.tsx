// app/layout.tsx
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import NavBar from "@/components/NavBar";

export const metadata = { title: "Ivy Homes — Chennai" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <AuthProvider>
          <NavBar />
          <main className="max-w-6xl mx-auto p-4">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
