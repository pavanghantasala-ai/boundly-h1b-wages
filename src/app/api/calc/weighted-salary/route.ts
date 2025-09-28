import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/*
Request JSON:
{
  "offeredSalaryAnnual": number,
  "medianSalaryForSoc": number,
  "totalRegistrations": number,
  "selectedCount": number
}

Response JSON:
{
  "weight": number,
  "probability": number,
  "inputs": {...}
}

Formula:
  w = clamp(offeredSalaryAnnual / medianSalaryForSoc, 0.1, 10)
  p = (w / (w_total)) * selectedCount
For single-case estimation, we approximate denominator with N_total (so p ≈ w / N_total * selectedCount),
which is useful for a relative comparison UI. For multi-case, use bulk endpoint.
*/
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const offeredSalaryAnnual = Number(body.offeredSalaryAnnual || 0);
    const medianSalaryForSoc = Number(body.medianSalaryForSoc || 0);
    const totalRegistrations = Number(body.totalRegistrations || 0);
    const selectedCount = Number(body.selectedCount || 0);

    if (!Number.isFinite(offeredSalaryAnnual) || offeredSalaryAnnual <= 0) {
      return NextResponse.json({ error: "offeredSalaryAnnual must be > 0" }, { status: 400 });
    }
    if (!Number.isFinite(medianSalaryForSoc) || medianSalaryForSoc <= 0) {
      return NextResponse.json({ error: "medianSalaryForSoc must be > 0" }, { status: 400 });
    }
    if (!Number.isFinite(totalRegistrations) || totalRegistrations <= 0) {
      return NextResponse.json({ error: "totalRegistrations must be > 0" }, { status: 400 });
    }
    if (!Number.isFinite(selectedCount) || selectedCount < 0) {
      return NextResponse.json({ error: "selectedCount must be >= 0" }, { status: 400 });
    }

    const raw = offeredSalaryAnnual / medianSalaryForSoc;
    const weight = Math.min(10, Math.max(0.1, raw));
    // single-case approximation for UI comparison
    const probability = Math.max(0, Math.min(1, (weight / totalRegistrations) * selectedCount));

    return NextResponse.json({ weight, probability, inputs: { offeredSalaryAnnual, medianSalaryForSoc, totalRegistrations, selectedCount } });
  } catch (e) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
