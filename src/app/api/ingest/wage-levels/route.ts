import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/*
Ingest WageIndex rows from Supabase -> Prisma.WageIndex
Env required:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY

Request JSON (optional):
{
  "year": "2025-26" | "2024-25" | "2023-24"
}
*/
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const year = (body?.year as string) || undefined;

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env" },
        { status: 500 }
      );
    }

    const pageSize = 1000;
    let from = 0;
    let to = pageSize - 1;
    let totalImported = 0;

    // If a year is provided, we'll clear that year's rows before import
    if (year) {
      await prisma.wageIndex.deleteMany({ where: { year } });
    }

    // Fetch in pages from Supabase REST (PostgREST)
    // Table: WageIndex with columns: id, year, soc, title, areaCode, areaName, unit, level1..level4
    // Note: we ignore the remote id and generate new ids locally

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const url = new URL(`${SUPABASE_URL}/rest/v1/WageIndex`);
      url.searchParams.set(
        "select",
        "year,soc,title,areaCode,areaName,unit,level1,level2,level3,level4"
      );
      if (year) {
        url.searchParams.set("year", `eq.${year}`);
      }

      const resp = await fetch(url.toString(), {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          Range: `${from}-${to}`,
          "Prefer": "count=exact",
        } as any,
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        return NextResponse.json(
          { error: `Supabase fetch failed: ${resp.status} ${text}` },
          { status: 502 }
        );
      }

      const batch = (await resp.json()) as Array<{
        year: string;
        soc: string;
        title: string;
        areaCode: string;
        areaName: string;
        unit: string; // 'hourly' or 'annual' — dataset is typically hourly
        level1: number;
        level2: number;
        level3: number;
        level4: number;
      }>;

      if (!Array.isArray(batch) || batch.length === 0) {
        break;
      }

      // Insert in smaller chunks to avoid payload size limits
      const rows = batch.map((r) => ({
        year: r.year,
        soc: r.soc,
        title: r.title,
        areaCode: r.areaCode,
        areaName: r.areaName,
        unit: r.unit,
        level1: Number(r.level1),
        level2: Number(r.level2),
        level3: Number(r.level3),
        level4: Number(r.level4),
      }));

      const chunk = 500;
      for (let i = 0; i < rows.length; i += chunk) {
        const slice = rows.slice(i, i + chunk);
        await prisma.wageIndex.createMany({ data: slice, skipDuplicates: true });
      }

      totalImported += rows.length;

      // Next page
      from = to + 1;
      to = from + pageSize - 1;
    }

    return NextResponse.json({ ok: true, imported: totalImported, year: year || null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 });
  }
}
