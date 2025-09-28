import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/*
Request JSON:
{
  "wageLevel": 1|2|3|4,
  "totalRegistrations": number,
  "selectedCount": number
}

Response JSON:
{
  "entries": number,          // entries implied by level weight
  "probability": number,      // entries / total_entries * selectedCount (single-case approx => entries / N_total * selectedCount)
  "buckets": {"1": number, "2": number, "3": number, "4": number},
  "inputs": {...}
}

If no AppSetting exists, fallback to {1:1,2:2,3:4,4:10}.
For single-case estimator, denominator is approximated by N_total.
*/
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const wageLevel = Number(body.wageLevel || 0);
    const totalRegistrations = Number(body.totalRegistrations || 0);
    const selectedCount = Number(body.selectedCount || 0);

    if (![1,2,3,4].includes(wageLevel)) {
      return NextResponse.json({ error: "wageLevel must be 1|2|3|4" }, { status: 400 });
    }
    if (!Number.isFinite(totalRegistrations) || totalRegistrations <= 0) {
      return NextResponse.json({ error: "totalRegistrations must be > 0" }, { status: 400 });
    }
    if (!Number.isFinite(selectedCount) || selectedCount < 0) {
      return NextResponse.json({ error: "selectedCount must be >= 0" }, { status: 400 });
    }

    const setting = await prisma.appSetting.findFirst({ orderBy: { createdAt: "desc" } });
    const buckets = (setting?.weightedBuckets as any) || { 1: 1, 2: 2, 3: 4, 4: 10 };
    const entries = Number(buckets[wageLevel] || 1);

    const probability = Math.max(0, Math.min(1, (entries / totalRegistrations) * selectedCount));

    return NextResponse.json({ entries, probability, buckets, inputs: { wageLevel, totalRegistrations, selectedCount } });
  } catch (e) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
