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

    const matches = index
      .map((r) => ({ areaName: r.areaName, areaCode: r.areaCode }))
      .filter((r) => r.areaName.toLowerCase().includes(q))
      .slice(0, 50);

    // Dedup by areaName
    const seen = new Set<string>();
    const dedup: { areaName: string; areaCode: string }[] = [];
    for (const m of matches) {
      if (!seen.has(m.areaName)) {
        seen.add(m.areaName);
        dedup.push(m);
      }
      if (dedup.length >= 10) break;
    }

    return NextResponse.json({ items: dedup });
  } catch (e) {
    return NextResponse.json({ items: [] });
  }
}
