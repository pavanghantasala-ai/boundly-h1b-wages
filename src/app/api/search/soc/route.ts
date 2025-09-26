import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    if (!q) return NextResponse.json({ items: [] });

    const pool = await prisma.wageIndex.findMany({
      where: {
        OR: [
          { soc: q },
          { soc: { startsWith: q } },
          { title: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { soc: true, title: true },
      take: 200,
    });

    type Row = { soc: string; title: string };
    const scored = pool.map((r: Row) => ({
      soc: r.soc,
      title: r.title,
      score:
        r.soc.toLowerCase() === q
          ? 100
          : r.title.toLowerCase().includes(q)
          ? 80
          : r.soc.toLowerCase().startsWith(q)
          ? 60
          : 0,
    }));
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
