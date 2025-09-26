import { NextRequest, NextResponse } from "next/server";
import { readIndex } from "@/lib/dataStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    if (!q) return NextResponse.json({ items: [] });

    const index = await readIndex();
    if (!index || index.length === 0) return NextResponse.json({ items: [] });

    // Score: exact soc match highest, then title includes, then soc startsWith
    const matches = index
      .map((r) => ({
        soc: r.soc,
        title: r.title,
        areaName: r.areaName,
        score:
          r.soc.toLowerCase() === q
            ? 100
            : r.title.toLowerCase().includes(q)
            ? 80
            : r.soc.toLowerCase().startsWith(q)
            ? 60
            : 0,
      }))
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score);

    // Deduplicate by SOC + title to avoid many area rows
    const seen = new Set<string>();
    const dedup: typeof matches = [];
    for (const m of matches) {
      const key = `${m.soc}|${m.title}`;
      if (!seen.has(key)) {
        seen.add(key);
        dedup.push(m);
      }
      if (dedup.length >= 10) break;
    }

    return NextResponse.json({ items: dedup });
  } catch (e) {
    return NextResponse.json({ items: [] });
  }
}
