"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, DollarSign, Calendar, AlertCircle } from "lucide-react";
import Logo from "@/components/Logo";
import Header from "@/components/Header";

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
  const { data: session, status } = useSession();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  // Core inputs
  const [socOrTitle, setSocOrTitle] = useState("");
  const [location, setLocation] = useState("");
  const [offeredWage, setOfferedWage] = useState("");
  const [offeredUnit, setOfferedUnit] = useState<"hourly" | "annual">("annual");
  const [year, setYear] = useState("2025-26");

  // Autocomplete state
  const [socQuery, setSocQuery] = useState("");
  const [socSuggestions, setSocSuggestions] = useState<Array<{ soc: string; title: string }>>([]);
  const [socLoading, setSocLoading] = useState(false);
  const [showSocSuggestions, setShowSocSuggestions] = useState(false);
  const [areaQuery, setAreaQuery] = useState("");
  const [areaSuggestions, setAreaSuggestions] = useState<Array<{ areaName: string; areaCode: string }>>([]);
  const [areaLoading, setAreaLoading] = useState(false);
  const [showAreaSuggestions, setShowAreaSuggestions] = useState(false);
  const [areaCode, setAreaCode] = useState<string | undefined>(undefined);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"wage" | "h1b">("wage");

  // Redirect unauthenticated users
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // Fetch SOC suggestions (debounced)
  useEffect(() => {
    const q = socQuery.trim();
    if (q.length < 2) {
      setSocSuggestions([]);
      setSocLoading(false);
      return;
    }
    setSocLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search/soc?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await r.json();
        const items: Array<{ soc: string; title: string }> = (data?.items || []).map((x: { soc: string; title: string }) => ({ soc: x.soc, title: x.title }));
        setSocSuggestions(items);
      } catch {
        setSocSuggestions([]);
      } finally {
        setSocLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [socQuery]);

  // Fetch Area suggestions (debounced)
  useEffect(() => {
    const q = areaQuery.trim();
    if (q.length < 2) {
      setAreaSuggestions([]);
      setAreaLoading(false);
      return;
    }
    setAreaLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search/area?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await r.json();
        const items: Array<{ areaName: string; areaCode: string }> = (data?.items || []).map((x: { areaName: string; areaCode: string }) => ({ areaName: x.areaName, areaCode: x.areaCode }));
        setAreaSuggestions(items);
      } catch {
        setAreaSuggestions([]);
      } finally {
        setAreaLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [areaQuery]);

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
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Request failed with ${resp.status}`);
      }
      const data: ApiResponse = await resp.json();
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 pt-24">
        <header className="mb-8 sm:mb-10">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Find your prevailing wage level</h1>
          <p className="text-base text-slate-600 mt-2">Enter a role and location to estimate the correct wage level and H‑1B selection weighting.</p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6 mb-8">
          <form className="grid gap-4 sm:gap-5" onSubmit={onSubmit}>
            {/* Role / SOC */}
            <div>
              <label className="block text-sm font-medium mb-1.5">What’s the role or SOC code?</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g., Software Developer or 15-1252"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base"
                  value={socOrTitle}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSocOrTitle(v);
                    setSocQuery(v);
                    setShowSocSuggestions(true);
                  }}
                  onFocus={() => socSuggestions.length > 0 && setShowSocSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSocSuggestions(false), 150)}
                  required
                />
                {showSocSuggestions && (
                  <div className="absolute z-20 mt-2 w-full max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                    {socLoading ? (
                      <div className="px-4 py-3 text-sm text-slate-500">Searching…</div>
                    ) : socQuery.trim().length >= 2 && socSuggestions.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-500">No matches. Try a different title or exact SOC code.</div>
                    ) : (
                      socSuggestions.slice(0, 10).map((s) => (
                        <button
                          type="button"
                          key={`${s.soc}|${s.title}`}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50"
                          onClick={() => {
                            setSocOrTitle(`${s.soc}`);
                            setSocQuery("");
                            setSocSuggestions([]);
                            setShowSocSuggestions(false);
                          }}
                        >
                          <div className="font-medium">{s.title}</div>
                          <div className="text-xs text-slate-500">{s.soc}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2">Tip: Exact SOC gives the best match. Your employer or counsel can provide your SOC.</p>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Where is the job located?</label>
              <input
                type="text"
                placeholder="City, State (we’ll map this to the closest area)"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>

            {/* Area (optional) */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Do you know the area (optional)?</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Start typing a county/MSA area name"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base"
                  value={areaQuery}
                  onChange={(e) => {
                    setAreaQuery(e.target.value);
                    setAreaCode(undefined);
                    setShowAreaSuggestions(true);
                  }}
                  onFocus={() => areaSuggestions.length > 0 && setShowAreaSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowAreaSuggestions(false), 150)}
                />
                {showAreaSuggestions && (
                  <div className="absolute z-20 mt-2 w-full max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                    {areaLoading ? (
                      <div className="px-4 py-3 text-sm text-slate-500">Searching areas…</div>
                    ) : areaQuery.trim().length >= 2 && areaSuggestions.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-500">No areas found. Try a different spelling.</div>
                    ) : (
                      areaSuggestions.slice(0, 10).map((a) => (
                        <button
                          type="button"
                          key={`${a.areaCode}|${a.areaName}`}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50"
                          onClick={() => {
                            setAreaQuery(a.areaName);
                            setAreaCode(a.areaCode);
                            setAreaSuggestions([]);
                            setShowAreaSuggestions(false);
                          }}
                        >
                          <div className="font-medium">{a.areaName}</div>
                          <div className="text-xs text-slate-500">Code: {a.areaCode}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
                {areaCode && (
                  <p className="text-xs text-slate-500 mt-2">Selected area code: {areaCode}</p>
                )}
              </div>
            </div>

            {/* Wage + unit + year */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5">What is the offered wage?</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g., 120000"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base"
                  value={offeredWage}
                  onChange={(e) => setOfferedWage(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Unit</label>
                  <select
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base"
                    value={offeredUnit}
                    onChange={(e) => setOfferedUnit(e.target.value as any)}
                  >
                    <option value="annual">Annual</option>
                    <option value="hourly">Hourly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Year</label>
                  <select
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  >
                    <option value="2025-26">2025-26</option>
                    <option value="2024-25">2024-25</option>
                    <option value="2023-24">2023-24</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 text-sm font-medium disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Calculating…" : "Get wage level"}
              </button>
              {error && <span className="text-sm text-red-600">{error}</span>}
            </div>
          </form>
        </section>

        {!result && (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            Enter a role, location, and wage to see your results here.
          </div>
        )}

        {result && (
          <section className="grid gap-4">
            <div className="rounded-2xl border border-slate-200 p-6 bg-white">
              <h2 className="text-base font-semibold mb-3">Provider match</h2>
              <p className="text-sm text-slate-700">SOC {result.providerMatch.soc} — {result.providerMatch.title}</p>
              <p className="text-sm text-slate-700">Area: {result.providerMatch.area}</p>
              <div className="mt-3 text-sm grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-lg border border-slate-200 p-3">L1: ${" "}{result.providerMatch.wages.level1.toFixed(2)}/hr</div>
                <div className="rounded-lg border border-slate-200 p-3">L2: ${" "}{result.providerMatch.wages.level2.toFixed(2)}/hr</div>
                <div className="rounded-lg border border-slate-200 p-3">L3: ${" "}{result.providerMatch.wages.level3.toFixed(2)}/hr</div>
                <div className="rounded-lg border border-slate-200 p-3">L4: ${" "}{result.providerMatch.wages.level4.toFixed(2)}/hr</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-6 bg-white">
              <h2 className="text-base font-semibold mb-3">Your result</h2>
              <p className="text-sm">Offered (hourly): ${" "}{result.computation.offeredHourly.toFixed(2)} /hr</p>
              <p className="text-sm mt-1">Computed level: Level {result.computation.level}</p>
              {result.computation.belowLevel1 && (
                <p className="text-sm text-orange-600 mt-1">Note: Offered wage is below Level I.</p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 p-6 bg-white">
              <h2 className="text-base font-semibold mb-3">H‑1B selection weighting</h2>
              <p className="text-sm">Chances: {result.lottery.weight} per the wage level.</p>
              <p className="text-xs text-slate-500 mt-1">{result.lottery.rationale}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-6 bg-slate-50">
              <p className="text-xs text-slate-500">{result.disclaimer}</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
