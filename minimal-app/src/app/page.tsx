"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type WageRow = {
  soc: string;
  title: string;
  areaCode: string;
  areaName: string;
  unit: string; // 'hourly' or 'annual'
  level1: number;
  level2: number;
  level3: number;
  level4: number;
};

function toHourly(value: number, unit: "hourly" | "annual") {
  return unit === "annual" ? value / 2080 : value;
}

export default function HomePage() {
  const [socOrTitle, setSocOrTitle] = useState("");
  const [areaQuery, setAreaQuery] = useState("");
  const [areaCode, setAreaCode] = useState<string | undefined>(undefined);
  const [offered, setOffered] = useState("");
  const [unit, setUnit] = useState<"annual" | "hourly">("annual");

  const [socItems, setSocItems] = useState<Array<{ soc: string; title: string }>>([]);
  const [areaItems, setAreaItems] = useState<Array<{ areaName: string; areaCode: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<
    | null
    | {
        match: { soc: string; title: string; area: string };
        offeredHourly: number;
        level: 1 | 2 | 3 | 4;
      }
  >(null);

  // Debounced SOC search
  useEffect(() => {
    const q = socOrTitle.trim();
    if (q.length < 2) {
      setSocItems([]);
      return;
    }
    const t = setTimeout(async () => {
      const or = `or=(soc.ilike.${q.replaceAll("(", "").replaceAll(")","")}*,title.ilike.*${q}*)`;
      const { data } = await supabase
        .from("WageIndex")
        .select("soc,title")
        .or(or)
        .range(0, 49);
      const seen = new Set<string>();
      const items: Array<{ soc: string; title: string }> = [];
      (data || []).forEach((r: any) => {
        const key = `${r.soc}|${r.title}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({ soc: r.soc, title: r.title });
        }
      });
      setSocItems(items.slice(0, 10));
    }, 250);
    return () => clearTimeout(t);
  }, [socOrTitle]);

  // Debounced Area search
  useEffect(() => {
    const q = areaQuery.trim();
    if (q.length < 2) {
      setAreaItems([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("WageIndex")
        .select("areaName,areaCode")
        .ilike("areaName", `*${q}*`)
        .range(0, 49);
      const seen = new Set<string>();
      const items: Array<{ areaName: string; areaCode: string }> = [];
      (data || []).forEach((r: any) => {
        const key = `${r.areaCode}|${r.areaName}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({ areaName: r.areaName, areaCode: r.areaCode });
        }
      });
      setAreaItems(items.slice(0, 10));
    }, 250);
    return () => clearTimeout(t);
  }, [areaQuery]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const q = socOrTitle.trim();
      if (!q) throw new Error("Enter role or SOC");
      const offeredNum = Number(offered);
      if (!Number.isFinite(offeredNum) || offeredNum <= 0) throw new Error("Enter a valid wage");

      // Query a small pool by SOC exact/prefix or title contains; optionally filter by areaCode
      let query = supabase
        .from("WageIndex")
        .select("soc,title,areaName,areaCode,unit,level1,level2,level3,level4")
        .or(`soc.ilike.${q}*,title.ilike.*${q}*`)
        .range(0, 199);
      if (areaCode) query = query.eq("areaCode", areaCode);
      const { data, error: sbErr } = await query;
      if (sbErr) throw sbErr;
      const rows = (data || []) as WageRow[];
      if (rows.length === 0) throw new Error("No wage data found for query");

      const socExact = rows.find((r) => r.soc.toLowerCase() === q.toLowerCase());
      const rec = socExact || rows[0];

      const offeredHourly = toHourly(offeredNum, unit);
      const levels = [rec.level1, rec.level2, rec.level3, rec.level4].map((v) => toHourly(v, rec.unit as any));
      let level: 1 | 2 | 3 | 4 = 1;
      if (offeredHourly <= levels[0]) level = 1;
      else if (offeredHourly <= levels[1]) level = 2;
      else if (offeredHourly <= levels[2]) level = 3;
      else level = 4;

      setResult({
        match: { soc: rec.soc, title: rec.title, area: rec.areaName },
        offeredHourly,
        level,
      });
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1 style={{ fontSize: 26, fontWeight: 600, margin: "8px 0 16px" }}>H‑1B Wage Estimator</h1>
      <p style={{ color: "#475569", fontSize: 14, marginBottom: 16 }}>Enter a role/SOC, area, and wage. We’ll estimate your prevailing wage level.</p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 14, marginBottom: 6 }}>Role or SOC code</label>
          <input
            value={socOrTitle}
            onChange={(e) => setSocOrTitle(e.target.value)}
            placeholder="e.g., Software Developer or 15-1252"
            required
            style={{ width: "100%", padding: "12px 14px", border: "1px solid #cbd5e1", borderRadius: 12 }}
          />
          {socItems.length > 0 && (
            <div style={{ border: "1px solid #e2e8f0", borderTop: "none", borderRadius: 12, marginTop: 6, maxHeight: 240, overflow: "auto" }}>
              {socItems.map((s) => (
                <button
                  key={`${s.soc}|${s.title}`}
                  type="button"
                  onClick={() => setSocOrTitle(s.soc)}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", background: "white", border: "none", cursor: "pointer" }}
                >
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{s.soc}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label style={{ display: "block", fontSize: 14, marginBottom: 6 }}>Area (optional)</label>
          <input
            value={areaQuery}
            onChange={(e) => {
              setAreaQuery(e.target.value);
              setAreaCode(undefined);
            }}
            placeholder="County / MSA name"
            style={{ width: "100%", padding: "12px 14px", border: "1px solid #cbd5e1", borderRadius: 12 }}
          />
          {areaItems.length > 0 && (
            <div style={{ border: "1px solid #e2e8f0", borderTop: "none", borderRadius: 12, marginTop: 6, maxHeight: 240, overflow: "auto" }}>
              {areaItems.map((a) => (
                <button
                  key={`${a.areaCode}|${a.areaName}`}
                  type="button"
                  onClick={() => {
                    setAreaQuery(a.areaName);
                    setAreaCode(a.areaCode);
                  }}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", background: "white", border: "none", cursor: "pointer" }}
                >
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{a.areaName}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Code: {a.areaCode}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 14, marginBottom: 6 }}>Offered wage</label>
            <input
              value={offered}
              onChange={(e) => setOffered(e.target.value)}
              placeholder="e.g., 120000"
              inputMode="decimal"
              style={{ width: "100%", padding: "12px 14px", border: "1px solid #cbd5e1", borderRadius: 12 }}
              required
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 14, marginBottom: 6 }}>Unit</label>
            <div style={{ display: "inline-flex", border: "1px solid #cbd5e1", borderRadius: 12, overflow: "hidden" }}>
              <button type="button" onClick={() => setUnit("annual")} style={{ padding: "8px 12px", background: unit === "annual" ? "#2563eb" : "white", color: unit === "annual" ? "white" : "#0f172a", border: "none" }}>Annual</button>
              <button type="button" onClick={() => setUnit("hourly")} style={{ padding: "8px 12px", background: unit === "hourly" ? "#2563eb" : "white", color: unit === "hourly" ? "white" : "#0f172a", borderLeft: "1px solid #cbd5e1", borderTop: "none", borderRight: "none", borderBottom: "none" }}>Hourly</button>
            </div>
          </div>
        </div>

        <div style={{ position: "sticky", bottom: 16 }}>
          <button disabled={loading} type="submit" style={{ width: "100%", padding: "12px 14px", background: "#2563eb", color: "white", border: "none", borderRadius: 12, fontWeight: 600 }}>
            {loading ? "Calculating…" : "Get wage level"}
          </button>
        </div>
        {error && <div style={{ color: "#dc2626", fontSize: 14 }}>{error}</div>}
      </form>

      {result && (
        <section style={{ marginTop: 16, border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>
            <strong>{result.match.title}</strong> — {result.match.soc}
          </div>
          <div style={{ fontSize: 14, color: "#475569" }}>Area: {result.match.area}</div>
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8 }}>
            {[1,2,3,4].map((lvl) => (
              <div key={lvl} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, textAlign: "center" }}>L{lvl}</div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 14 }}>Offered (hourly): ${result.offeredHourly.toFixed(2)} / hr</div>
          <div style={{ marginTop: 4, fontSize: 14, fontWeight: 600 }}>Computed level: Level {result.level}</div>
        </section>
      )}
    </main>
  );
}
