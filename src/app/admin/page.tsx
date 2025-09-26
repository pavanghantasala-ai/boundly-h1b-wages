"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const allow = useMemo(() => {
    const list = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    return list;
  }, []);
  const [year, setYear] = useState("2025-26");
  const [output, setOutput] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    const email = session?.user?.email?.toLowerCase();
    const authorized = !!email && (allow.length === 0 || allow.includes(email));
    if (!authorized) {
      router.replace("/");
    }
  }, [status, session, allow, router]);

  // Don't render anything until we're sure about authentication
  if (status === "loading" || status !== "authenticated") {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  async function runIngest() {
    setLoading(true);
    setError(null);
    setOutput(null);
    try {
      const resp = await fetch("/api/admin/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || `Failed: ${resp.status}`);
      setOutput(data);
    } catch (e: any) {
      setError(e.message || "Ingest failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />
      <div className="min-h-[70vh] max-w-3xl mx-auto px-6 py-10 pt-24">
      <h1 className="text-2xl font-semibold mb-4">Admin: Dataset Ingestion</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Download and parse the official OFLC/FLAG wage dataset for a selected year into a local index.
      </p>

      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">Year</label>
          <select
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-black px-3 py-2"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            <option value="2025-26">2025-26</option>
            <option value="2024-25">2024-25</option>
            <option value="2023-24">2023-24</option>
          </select>
        </div>
        <button
          onClick={runIngest}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Ingesting…" : "Run Ingestion"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {output && (
        <pre className="mt-4 text-xs whitespace-pre-wrap rounded-lg border border-gray-200 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-900/40">
          {JSON.stringify(output, null, 2)}
        </pre>
      )}
      </div>
    </>
  );
}
