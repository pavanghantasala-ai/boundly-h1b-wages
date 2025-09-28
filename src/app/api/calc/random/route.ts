import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/*
Request JSON:
{
  "totalRegistrations": number,  // N_total_registrations
  "selectedCount": number        // N_selected (cap incl. masters if desired)
}

Response JSON:
{
  "probability": number, // p = N_selected / N_total_registrations (0..1)
  "inputs": { totalRegistrations, selectedCount }
}
*/
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const totalRegistrations = Number(body.totalRegistrations || 0);
    const selectedCount = Number(body.selectedCount || 0);

    if (!Number.isFinite(totalRegistrations) || totalRegistrations <= 0) {
      return NextResponse.json({ error: "totalRegistrations must be > 0" }, { status: 400 });
    }
    if (!Number.isFinite(selectedCount) || selectedCount < 0) {
      return NextResponse.json({ error: "selectedCount must be >= 0" }, { status: 400 });
    }

    const probability = Math.max(0, Math.min(1, selectedCount / totalRegistrations));

    return NextResponse.json({ probability, inputs: { totalRegistrations, selectedCount } });
  } catch (e) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
