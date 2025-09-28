import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    if (!q) return NextResponse.json({ items: [] });

    // Fetch a generous pool and then de-duplicate by (soc,title)
    const pool = await prisma.wageIndex.findMany({
      where: {
        OR: [
          { soc: { startsWith: q } },
          { title: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { soc: true, title: true },
      take: 300,
    });

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
