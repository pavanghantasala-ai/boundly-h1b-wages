import { NextRequest, NextResponse } from "next/server";
import { lookupWages } from "@/lib/providers/flag";
import { determineWageLevel, estimateLotteryChance, normalizeToHourly, WageUnit } from "@/lib/wage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      socOrTitle,
      location,
      year = "2025-26",
      offeredWage,
      offeredUnit = "annual",
      areaCode,
    }: {
      socOrTitle: string;
      location: string;
      year?: string;
      offeredWage: number;
      offeredUnit?: WageUnit;
      areaCode?: string;
    } = body;

    if (!socOrTitle || !location || !Number.isFinite(offeredWage)) {
      return NextResponse.json(
        { error: "Missing required fields: socOrTitle, location, offeredWage" },
        { status: 400 }
      );
    }

    const wages = await lookupWages({ socOrTitle, location, year, areaCode });

    const offeredHourly = normalizeToHourly(Number(offeredWage), offeredUnit);
    const determination = determineWageLevel(offeredHourly, wages.wages);
    const lottery = estimateLotteryChance(determination.computedLevel);

    const disclaimer =
      "Results are estimates for informational purposes only and not legal advice. Providing an exact SOC code generally yields the most accurate result. Consult your employer or immigration counsel.";

    return NextResponse.json({
      inputs: { socOrTitle, location, year, offeredWage, offeredUnit, areaCode },
      providerMatch: {
        soc: wages.matchedSocCode,
        title: wages.matchedSocTitle,
        area: wages.areaName,
        unit: wages.unit,
        wages: wages.wages,
      },
      computation: {
        offeredHourly,
        level: determination.computedLevel,
        belowLevel1: determination.belowLevel1,
      },
      lottery,
      disclaimer,
    });
  } catch (err: any) {
    console.error("/api/wages error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
