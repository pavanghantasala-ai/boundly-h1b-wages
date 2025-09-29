import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    if (!q) return NextResponse.json({ items: [] });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ items: [] });
    }

    // Fetch a generous pool via Supabase REST and then de-duplicate by (soc,title)
    const url = new URL(`${SUPABASE_URL}/rest/v1/WageIndex`);
    url.searchParams.set("select", "soc,title");
    // OR filter (PostgREST): or=(soc.ilike.q*,title.ilike.*q*)
    const encQ = encodeURIComponent(q);
    url.searchParams.set("or", `(soc.ilike.${encQ}*,title.ilike.*${encQ}*)`);
    const resp = await fetch(url.toString(), {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Range: "0-299",
        Prefer: "count=exact",
      } as any,
    });
    if (!resp.ok) return NextResponse.json({ items: [] });
    const pool = (await resp.json()) as Array<{ soc: string; title: string }>;

    // Prefer exact SOC matches first, then title contains, then SOC prefix
    type Row = { soc: string; title: string };
    const scored = pool.map((r: Row) => {
      const socLc = r.soc.toLowerCase();
      const titleLc = r.title.toLowerCase();
      let score = 0;
      if (socLc === q) score = 100;
      else if (titleLc.includes(q)) score = 85;
      else if (socLc.startsWith(q)) score = 70;
      return { soc: r.soc, title: r.title, score };
    });
    scored.sort((a, b) => b.score - a.score);

    const seen = new Set<string>();
    const items: Array<{ soc: string; title: string }> = [];
    for (const s of scored) {
      const key = `${s.soc}|${s.title}`;
      if (!seen.has(key) && s.score > 0) {
        seen.add(key);
        items.push({ soc: s.soc, title: s.title });
      }
      if (items.length >= 10) break;
    }

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ items: [] });
  }
}
