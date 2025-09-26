import { promises as fs } from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { IndexRecord, writeIndex } from "@/lib/dataStore";

function toNumber(x: any): number | null {
  if (x === undefined || x === null) return null;
  const s = String(x).replace(/[$,]/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toHourly(val: number | null, unitHint: "hourly" | "annual" | null): number | null {
  if (val == null) return null;
  if (unitHint === "annual") return val / 2080;
  return val; // treat as hourly by default
}

function pick<T extends Record<string, any>>(row: T, candidates: string[]): any {
  for (const c of candidates) {
    const v = row[c];
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
}

// Attempt to normalize a single CSV row from various historical schemas
function normalizeRow(row: Record<string, any>): IndexRecord | null {
  // Many FLAG wage files include these possible header names; we try multiple fallbacks
  const soc = pick(row, [
    "OES/SOC Code",
    "OES/SOC code",
    "SOC Code",
    "soc_code",
    "SOC",
  ]);
  const title = pick(row, [
    "OES/SOC Title",
    "SOC Title",
    "soc_title",
    "Occupation Title",
  ]);
  const areaCode = pick(row, [
    "Area Code",
    "area_code",
    "CBSA Code",
    "FIPS Area Code",
  ]);
  const areaName = pick(row, [
    "Area Name",
    "area_name",
    "CBSA Title",
    "FIPS Area Name",
  ]);

  // Hourly/Annual wage columns (try hourly first, then annual)
  const l1h = toNumber(
    pick(row, [
      "Level 1 Wage - Hourly",
      "Level I Wage - Hourly",
      "Level 1 Hourly",
      "Wage Level 1 Hourly",
      "L1_Hourly",
      "Level I - Hourly",
    ])
  );
  const l1a = toNumber(
    pick(row, [
      "Level 1 Wage - Annual",
      "Level I Wage - Annual",
      "Level 1 Annual",
      "Wage Level 1 Annual",
      "L1_Annual",
      "Level I - Annual",
    ])
  );

  const l2h = toNumber(
    pick(row, [
      "Level 2 Wage - Hourly",
      "Level II Wage - Hourly",
      "Level 2 Hourly",
      "Wage Level 2 Hourly",
      "L2_Hourly",
      "Level II - Hourly",
    ])
  );
  const l2a = toNumber(
    pick(row, [
      "Level 2 Wage - Annual",
      "Level II Wage - Annual",
      "Level 2 Annual",
      "Wage Level 2 Annual",
      "L2_Annual",
      "Level II - Annual",
    ])
  );

  const l3h = toNumber(
    pick(row, [
      "Level 3 Wage - Hourly",
      "Level III Wage - Hourly",
      "Level 3 Hourly",
      "Wage Level 3 Hourly",
      "L3_Hourly",
      "Level III - Hourly",
    ])
  );
  const l3a = toNumber(
    pick(row, [
      "Level 3 Wage - Annual",
      "Level III Wage - Annual",
      "Level 3 Annual",
      "Wage Level 3 Annual",
      "L3_Annual",
      "Level III - Annual",
    ])
  );

  const l4h = toNumber(
    pick(row, [
      "Level 4 Wage - Hourly",
      "Level IV Wage - Hourly",
      "Level 4 Hourly",
      "Wage Level 4 Hourly",
      "L4_Hourly",
      "Level IV - Hourly",
    ])
  );
  const l4a = toNumber(
    pick(row, [
      "Level 4 Wage - Annual",
      "Level IV Wage - Annual",
      "Level 4 Annual",
      "Wage Level 4 Annual",
      "L4_Annual",
      "Level IV - Annual",
    ])
  );

  if (!soc || !title || !areaName) return null;

  const level1 = toHourly(l1h ?? l1a ?? null, l1h != null ? "hourly" : l1a != null ? "annual" : null);
  const level2 = toHourly(l2h ?? l2a ?? null, l2h != null ? "hourly" : l2a != null ? "annual" : null);
  const level3 = toHourly(l3h ?? l3a ?? null, l3h != null ? "hourly" : l3a != null ? "annual" : null);
  const level4 = toHourly(l4h ?? l4a ?? null, l4h != null ? "hourly" : l4a != null ? "annual" : null);

  if (
    level1 == null || level2 == null || level3 == null || level4 == null
  )
    return null;

  return {
    soc: String(soc),
    title: String(title),
    areaCode: String(areaCode ?? ""),
    areaName: String(areaName),
    unit: "hourly",
    level1,
    level2,
    level3,
    level4,
  };
}

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

export async function buildIndexFromExtracted(rootDir: string): Promise<{count: number, samples: IndexRecord[]}> {
  const records: IndexRecord[] = [];
  for await (const file of walk(rootDir)) {
    if (!file.toLowerCase().endsWith(".csv")) continue;
    const content = await fs.readFile(file, "utf8");
    const rows = parse(content, { columns: true, skip_empty_lines: true });
    for (const row of rows as Record<string, any>[]) {
      const rec = normalizeRow(row);
      if (rec) records.push(rec);
    }
  }
  if (records.length > 0) {
    await writeIndex(records);
  }
  return { count: records.length, samples: records.slice(0, 5) };
}
