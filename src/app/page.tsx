"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

type ApiResponse = {
  inputs: {
    socOrTitle: string;
    location: string;
    year: string;
    offeredWage: number;
    offeredUnit: "hourly" | "annual";
  };
  providerMatch: {
    soc: string;
    title: string;
    area: string;
    unit: "hourly";
    wages: { level1: number; level2: number; level3: number; level4: number };
  };
  computation: { offeredHourly: number; level: 1 | 2 | 3 | 4; belowLevel1: boolean };
  lottery: { weight: 1 | 2 | 3 | 4; rationale: string };
  disclaimer: string;
};

export default function Home() {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) {
      router.replace("/login");
    }

  // Fetch SOC suggestions
  useEffect(() => {
    const q = socQuery.trim();
    if (q.length < 2) {
      setSocSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const run = async () => {
      try {
        const r = await fetch(`/api/search/soc?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await r.json();
        const items: Array<{ soc: string; title: string }> = (data?.items || []).map((x: any) => ({ soc: x.soc, title: x.title }));
        setSocSuggestions(items);
      } catch (_) {}
    };
    run();
    return () => ctrl.abort();
  }, [socQuery]);

  // Fetch Area suggestions
  useEffect(() => {
    const q = areaQuery.trim();
    if (q.length < 2) {
      setAreaSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const run = async () => {
      try {
        const r = await fetch(`/api/search/area?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await r.json();
        const items: Array<{ areaName: string; areaCode: string }> = (data?.items || []).map((x: any) => ({ areaName: x.areaName, areaCode: x.areaCode }));
        setAreaSuggestions(items);
      } catch (_) {}
    };
    run();
    return () => ctrl.abort();
  }, [areaQuery]);
  }, [ready, user, router]);

  if (!ready || !user) {
    return null;
  }

  const [socOrTitle, setSocOrTitle] = useState("");
  const [location, setLocation] = useState("");
  const [offeredWage, setOfferedWage] = useState("");
  const [offeredUnit, setOfferedUnit] = useState<"hourly" | "annual">("annual");
  const [year, setYear] = useState("2025-26");

  // Autocomplete state
  const [socQuery, setSocQuery] = useState("");
  const [socSuggestions, setSocSuggestions] = useState<Array<{ soc: string; title: string }>>([]);
  const [areaQuery, setAreaQuery] = useState("");
  const [areaSuggestions, setAreaSuggestions] = useState<Array<{ areaName: string; areaCode: string }>>([]);
  const [areaCode, setAreaCode] = useState<string | undefined>(undefined);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch("/api/wages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socOrTitle,
          location,
          offeredWage: Number(offeredWage),
          offeredUnit,
          year,
          areaCode,
        }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `Request failed with ${resp.status}`);
      }
      const data: ApiResponse = await resp.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-black dark:text-white">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Boundly</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Find your prevailing wage level and a selection-weight estimate.
          </p>
        </header>

        <section className="bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-8">
          <form className="grid gap-4" onSubmit={onSubmit}>
            <div>
              <label className="block text-sm font-medium mb-1">SOC code or Job title</label>
              <input
                type="text"
                placeholder="e.g., 15-1252 or Software Developer"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-black px-3 py-2"
                value={socOrTitle}
                onChange={(e) => {
                  const v = e.target.value;
                  setSocOrTitle(v);
                  setSocQuery(v);
                }}
                required
              />
              {socSuggestions.length > 0 && (
                <div className="mt-2 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden divide-y divide-gray-200 dark:divide-gray-800">
                  {socSuggestions.map((s) => (
                    <button
                      type="button"
                      key={`${s.soc}|${s.title}`}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
                      onClick={() => {
                        setSocOrTitle(`${s.soc}`);
                        setSocQuery("");
                        setSocSuggestions([]);
                      }}
                    >
                      {s.title} — {s.soc}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Providing an exact SOC code will yield the most accurate result. Consult your employer or immigration counsel for your SOC.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <input
                type="text"
                placeholder="City, State (we'll map to the closest area)"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-black px-3 py-2"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Area (optional)</label>
              <input
                type="text"
                placeholder="Start typing a county/MSA area name"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-black px-3 py-2"
                value={areaQuery}
                onChange={(e) => {
                  setAreaQuery(e.target.value);
                  setAreaCode(undefined);
                }}
              />
              {areaSuggestions.length > 0 && (
                <div className="mt-2 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden divide-y divide-gray-200 dark:divide-gray-800">
                  {areaSuggestions.map((a) => (
                    <button
                      type="button"
                      key={`${a.areaCode}|${a.areaName}`}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
                      onClick={() => {
                        setAreaQuery(a.areaName);
                        setAreaCode(a.areaCode);
                        setAreaSuggestions([]);
                      }}
                    >
                      {a.areaName}
                    </button>
                  ))}
                </div>
              )}
              {areaCode && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Selected area code: {areaCode}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Offered wage</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g., 120000"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-black px-3 py-2"
                  value={offeredWage}
                  onChange={(e) => setOfferedWage(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Unit</label>
                <select
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-black px-3 py-2"
                  value={offeredUnit}
                  onChange={(e) => setOfferedUnit(e.target.value as any)}
                >
                  <option value="annual">Annual</option>
                  <option value="hourly">Hourly</option>
                </select>
              </div>
            </div>

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

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Calculating…" : "Check wage level"}
              </button>
              {error && <span className="text-sm text-red-600">{error}</span>}
            </div>
          </form>
        </section>

        {result && (
          <section className="grid gap-4">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-black">
              <h2 className="text-lg font-semibold mb-3">Provider match</h2>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                SOC {result.providerMatch.soc} — {result.providerMatch.title}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Area: {result.providerMatch.area}
              </p>
              <div className="mt-3 text-sm">
                <div>Level I: ${" "}{result.providerMatch.wages.level1.toFixed(2)} /hr</div>
                <div>Level II: ${" "}{result.providerMatch.wages.level2.toFixed(2)} /hr</div>
                <div>Level III: ${" "}{result.providerMatch.wages.level3.toFixed(2)} /hr</div>
                <div>Level IV: ${" "}{result.providerMatch.wages.level4.toFixed(2)} /hr</div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-black">
              <h2 className="text-lg font-semibold mb-3">Your result</h2>
              <p className="text-sm">Offered (hourly): ${" "}{result.computation.offeredHourly.toFixed(2)} /hr</p>
              <p className="text-sm mt-1">Computed level: Level {result.computation.level}</p>
              {result.computation.belowLevel1 && (
                <p className="text-sm text-orange-600 mt-1">Note: Offered wage is below Level I.</p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-black">
              <h2 className="text-lg font-semibold mb-3">H-1B selection weighting</h2>
              <p className="text-sm">Chances: {result.lottery.weight} per the wage level.</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{result.lottery.rationale}</p>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-6 bg-gray-50 dark:bg-gray-900/40">
              <p className="text-xs text-gray-600 dark:text-gray-400">{result.disclaimer}</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
