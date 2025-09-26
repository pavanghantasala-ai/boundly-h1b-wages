import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { AuthProvider, useAuth } from "@/components/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Boundly",
  description: "Find your prevailing wage level and H-1B selection weighting",
};

function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold">Boundly</Link>
        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <span className="text-gray-700 dark:text-gray-300">Hi, {user.name}</span>
              <button
                onClick={logout}
                className="rounded-md border px-3 py-1 hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md border px-3 py-1 hover:bg-gray-50 dark:hover:bg-gray-900"
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <Header />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
