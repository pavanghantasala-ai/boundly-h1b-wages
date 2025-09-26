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

const WAGE_COL_CANDIDATES = [
  "Level 1 Wage - Hourly",
  "Level I Wage - Hourly",
  "Level 1 Hourly",
  "Wage Level 1 Hourly",
  "L1_Hourly",
  "Level I - Hourly",
  "Level 1 Wage - Annual",
  "Level I Wage - Annual",
  "Level 1 Annual",
  "Wage Level 1 Annual",
  "L1_Annual",
  "Level I - Annual",
];

function detectDelimiter(sample: string): string | undefined {
  const candidates = [",", "\t", ";", "|"];
  let best: { delim: string; score: number } | null = null;
  for (const d of candidates) {
    const parts = sample.split(d);
    const score = parts.length;
    if (!best || score > best.score) best = { delim: d, score };
  }
  return best?.delim;
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

export async function buildIndexFromExtracted(rootDir: string): Promise<{count: number, samples: IndexRecord[], records: IndexRecord[]}> {
  const records: IndexRecord[] = [];
  // Build helper maps when present
  const areaNameByCode = new Map<string, string>();
  const titleBySoc = new Map<string, string>();

  // First pass: build dictionaries from EDC/Geography and SOC title sources
  for await (const file of walk(rootDir)) {
    if (!file.toLowerCase().endsWith(".csv")) continue;
    const base = path.basename(file).toLowerCase();
    try {
      const content = await fs.readFile(file, "utf8");
      const firstLine = content.split(/\r?\n/).find((l) => l.trim().length > 0) || "";
      const delim = detectDelimiter(firstLine) || ",";
      const rows = parse(content, { columns: true, skip_empty_lines: true, delimiter: delim as any, relax_quotes: true, relax_column_count: true, bom: true });
      // Area dictionaries
      if (base.includes("edc_export.csv") || base.includes("geography.csv")) {
        for (const row of rows as Record<string, any>[]) {
          const area = String(pick(row, ["Area", "Area Code", "area_code"])) || "";
          const areaName = String(pick(row, ["AreaName", "Area Name", "area_name", "CBSA Title", "FIPS Area Name"])) || "";
          if (area && areaName) areaNameByCode.set(area, areaName);
        }
      }
      // SOC title dictionaries
      if (base.includes("oes_soc_occs.csv") || base.includes("xwalk_plus.csv") || base.includes("onet_occs.csv")) {
        for (const row of rows as Record<string, any>[]) {
          const soc = String(pick(row, ["OES_SOCCODE", "soccode", "SOC Code", "soc_code", "SOC"])) || "";
          const title = String(pick(row, ["OES_SOCTITLE", "Title", "OES/SOC Title", "SOC Title"])) || "";
          if (soc && title) titleBySoc.set(soc, title);
        }
      }
    } catch {
      // ignore
    }
  }

  // Second pass: process wage rows
  for await (const file of walk(rootDir)) {
    if (!file.toLowerCase().endsWith(".csv")) continue;
    try {
      const content = await fs.readFile(file, "utf8");
      // Quick header-based filtering: ensure file likely contains wage data
      const firstLine = content.split(/\r?\n/).find((l) => l.trim().length > 0) || "";
      const delim = detectDelimiter(firstLine) || ",";
      const rows = parse(content, {
        columns: true,
        skip_empty_lines: true,
        delimiter: delim as any,
        relax_quotes: true,
        relax_column_count: true,
        bom: true,
      });
      const headerKeys = Array.isArray(rows) && rows.length > 0 ? Object.keys(rows[0] as Record<string, any>) : [];
      const base = path.basename(file).toLowerCase();

      // Preferred path: ALC_Export.csv has Level1..Level4 and Area, SocCode
      const looksLikeALC = base.includes("alc_export.csv") && headerKeys.includes("Level1") && headerKeys.includes("Area") && headerKeys.includes("SocCode");
      if (looksLikeALC) {
        for (const row of rows as Record<string, any>[]) {
          const area = String(row["Area"] || "");
          const soc = String(row["SocCode"] || "");
          const title = titleBySoc.get(soc) || String(soc);
          const areaName = areaNameByCode.get(area) || "";
          const l1 = toNumber(row["Level1"]);
          const l2 = toNumber(row["Level2"]);
          const l3 = toNumber(row["Level3"]);
          const l4 = toNumber(row["Level4"]);
          if (!area || !soc || !areaName || l1 == null || l2 == null || l3 == null || l4 == null) continue;
          records.push({
            soc,
            title,
            areaCode: area,
            areaName,
            unit: "hourly",
            level1: l1,
            level2: l2,
            level3: l3,
            level4: l4,
          });
        }
        continue;
      }

      // Generic fallback for any direct wage CSVs encountered
      const hasArea = headerKeys.some((k) =>
        ["Area", "Area Code", "area_code", "CBSA Code", "FIPS Area Code", "Area Name", "area_name", "CBSA Title", "FIPS Area Name"].includes(k)
      );
      const hasWage = headerKeys.some((k) => WAGE_COL_CANDIDATES.includes(k) || ["Level1", "Level2", "Level3", "Level4"].includes(k));
      if (!hasArea || !hasWage) {
        continue;
      }
      for (const row of rows as Record<string, any>[]) {
        // Try extended normalization supporting Level1..Level4 and Area/SocCode
        const area = String(pick(row, ["Area", "Area Code", "area_code", "CBSA Code", "FIPS Area Code"])) || "";
        const areaName = areaNameByCode.get(area) || String(pick(row, ["Area Name", "area_name", "CBSA Title", "FIPS Area Name"]) || "");
        const soc = String(pick(row, ["SocCode", "OES/SOC Code", "OES/SOC code", "SOC Code", "soc_code", "SOC"]) || "");
        const title = titleBySoc.get(soc) || String(pick(row, ["OES/SOC Title", "SOC Title", "Occupation Title"]) || soc);
        const l1 = toNumber(pick(row, ["Level1", ...WAGE_COL_CANDIDATES]));
        const l2 = toNumber(pick(row, ["Level2", "Level 2 Wage - Hourly", "Level II Wage - Hourly", "Level 2 Hourly", "Wage Level 2 Hourly", "L2_Hourly", "Level II - Hourly", "Level 2 Wage - Annual", "Level II Wage - Annual", "Level 2 Annual", "Wage Level 2 Annual", "L2_Annual", "Level II - Annual"]));
        const l3 = toNumber(pick(row, ["Level3", "Level 3 Wage - Hourly", "Level III Wage - Hourly", "Level 3 Hourly", "Wage Level 3 Hourly", "L3_Hourly", "Level III - Hourly", "Level 3 Wage - Annual", "Level III Wage - Annual", "Level 3 Annual", "Wage Level 3 Annual", "L3_Annual", "Level III - Annual"]));
        const l4 = toNumber(pick(row, ["Level4", "Level 4 Wage - Hourly", "Level IV Wage - Hourly", "Level 4 Hourly", "Wage Level 4 Hourly", "L4_Hourly", "Level IV - Hourly", "Level 4 Wage - Annual", "Level IV Wage - Annual", "Level 4 Annual", "Wage Level 4 Annual", "L4_Annual", "Level IV - Annual"]));
        if (!area || !areaName || !soc || !title || l1 == null || l2 == null || l3 == null || l4 == null) continue;
        records.push({ soc, title, areaCode: area, areaName, unit: "hourly", level1: l1, level2: l2, level3: l3, level4: l4 });
      }
    } catch (e) {
      // Skip files that are not well-formed CSVs (some downloads include ancillary CSVs)
      // console.warn(`Skipping unparsable file: ${file}`);
      continue;
    }
  }
  if (records.length > 0) {
    await writeIndex(records);
  }
  return { count: records.length, samples: records.slice(0, 5), records };
}

export function indexRecordsToDbRows(year: string, recs: IndexRecord[]) {
  return recs.map((r) => ({
    year,
    soc: r.soc,
    title: r.title,
    areaCode: r.areaCode,
    areaName: r.areaName,
    unit: r.unit,
    level1: String(r.level1),
    level2: String(r.level2),
    level3: String(r.level3),
    level4: String(r.level4),
  }));
}
