import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { ensureDataDir, dataInfo } from "@/lib/dataStore";
import { buildIndexFromExtracted } from "@/lib/ingest";

export const dynamic = "force-dynamic";

const YEAR_TO_URL: Record<string, string> = {
  "2025-26": "https://flag.dol.gov/sites/default/files/wages/OFLC_Wages_2025-26.zip",
  "2024-25": "https://flag.dol.gov/sites/default/files/wages/OFLC_Wages_2024-25.zip",
  "2023-24": "https://flag.dol.gov/sites/default/files/wages/OFLC_Wages_2023-24.zip",
};

async function extractZipTo(dir: string, buffer: ArrayBuffer) {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files) as any[];
  await fs.mkdir(dir, { recursive: true });
  const written: string[] = [];
  for (const entry of entries) {
    if ((entry as any).dir) continue;
    const content = await (entry as any).async("nodebuffer");
    const outPath = path.join(dir, (entry as any).name as string);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, content);
    written.push((entry as any).name as string);
  }
  return written;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const year = (body.year as string) || "2025-26";
    const url = YEAR_TO_URL[year];
    if (!url) {
      return NextResponse.json({ error: `Unsupported year: ${year}` }, { status: 400 });
    }

    await ensureDataDir();
    const { DATA_DIR } = dataInfo();
    const targetDir = path.join(DATA_DIR, "wages", year);

    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: `Download failed: ${res.status}` }, { status: 502 });
    }
    const buffer = await res.arrayBuffer();

    const files = await extractZipTo(targetDir, buffer);

    const built = await buildIndexFromExtracted(targetDir);

    return NextResponse.json({
      ok: true,
      year,
      url,
      extractedCount: files.length,
      dataDir: targetDir,
      indexCount: built.count,
      indexSamples: built.samples,
    });
  } catch (err: any) {
    console.error("/api/admin/ingest error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
