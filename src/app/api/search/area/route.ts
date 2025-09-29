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

    const url = new URL(`${SUPABASE_URL}/rest/v1/WageIndex`);
    url.searchParams.set("select", "areaName,areaCode");
    // PostgREST: areaName=ilike.*q*
    const encQ = encodeURIComponent(q);
    url.searchParams.set("areaName", `ilike.*${encQ}*`);
    // Limit server-side via Range header
    const resp = await fetch(url.toString(), {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Range: "0-299",
        Prefer: "count=exact",
      } as any,
    });
    if (!resp.ok) return NextResponse.json({ items: [] });
    const pool = (await resp.json()) as Array<{ areaName: string; areaCode: string }>;

    const seen = new Set<string>();
    const items: Array<{ areaName: string; areaCode: string }> = [];
    for (const m of pool) {
      const key = `${m.areaCode}|${m.areaName}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ areaName: m.areaName, areaCode: m.areaCode });
      }
      if (items.length >= 10) break;
    }

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ items: [] });
  }
}
