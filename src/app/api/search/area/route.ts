import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    if (!q) return NextResponse.json({ items: [] });

    const pool = await prisma.wageIndex.findMany({
      where: { areaName: { contains: q, mode: "insensitive" } },
      select: { areaName: true, areaCode: true },
      take: 200,
    });

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
