// Mock/real provider facade for FLAG / OFLC wages
// Exposes a function to lookup wages by SOC or job title and location/year

export type WageLevels = {
  level1: number; // hourly
  level2: number;
  level3: number;
  level4: number;
};

export type WageLookupRequest = {
  socOrTitle: string;
  location: string; // free text for now; future: state + county/MSA
  year: string; // e.g., "2025-26"
  areaCode?: string; // optional area filter if chosen via autocomplete
};

export type WageLookupResponse = {
  matchedSocCode: string;
  matchedSocTitle: string;
  areaName: string;
  unit: "hourly"; // all wages here are hourly
  wages: WageLevels;
};

import { readIndex, type IndexRecord } from "@/lib/dataStore";

// A tiny in-memory mock dataset. Replace with parsed CSV from OFLC zip.
const MOCK_DATA: Array<{
  soc: string;
  title: string;
  area: string;
  wages: WageLevels;
}> = [
  {
    soc: "15-1252",
    title: "Software Developers",
    area: "United States (National)",
    wages: { level1: 35, level2: 45, level3: 60, level4: 80 },
  },
  {
    soc: "15-1211",
    title: "Computer Systems Analysts",
    area: "United States (National)",
    wages: { level1: 32, level2: 42, level3: 55, level4: 70 },
  },
  {
    soc: "13-2011",
    title: "Accountants and Auditors",
    area: "United States (National)",
    wages: { level1: 28, level2: 36, level3: 48, level4: 62 },
  },
];

function bestMatchBySocOrTitleFromMock(query: string) {
  const q = query.trim().toLowerCase();
  // exact SOC code match first
  const exactSoc = MOCK_DATA.find((r) => r.soc.toLowerCase() === q);
  if (exactSoc) return exactSoc;
  // contains in title
  const contains = MOCK_DATA.find((r) => r.title.toLowerCase().includes(q));
  if (contains) return contains;
  // fallback to first
  return MOCK_DATA[0];
}

export async function lookupWages(
  req: WageLookupRequest
): Promise<WageLookupResponse> {
  // Attempt to use Supabase REST first (keeps Netlify functions small)
  const q = req.socOrTitle.trim().toLowerCase();
  const areaCode = req.areaCode;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const url = new URL(`${SUPABASE_URL}/rest/v1/WageIndex`);
      url.searchParams.set(
        "select",
        "soc,title,areaCode,areaName,unit,level1,level2,level3,level4"
      );
      if (areaCode) {
        url.searchParams.set("areaCode", `eq.${areaCode}`);
      }
      // OR: exact soc (prefix match), title contains, or soc prefix
      // PostgREST syntax: or=(soc.ilike.q*,title.ilike.*q*,soc.ilike.q*)
      const encQ = encodeURIComponent(q);
      url.searchParams.set("or", `(soc.ilike.${encQ}*,title.ilike.*${encQ}*,soc.ilike.${encQ}*)`);
      const resp = await fetch(url.toString(), {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          Range: "0-999",
          Prefer: "count=exact",
        } as any,
      });
      if (resp.ok) {
        const rows = (await resp.json()) as Array<{
          soc: string;
          title: string;
          areaCode: string;
          areaName: string;
          unit: string;
          level1: number;
          level2: number;
          level3: number;
          level4: number;
        }>;
        if (Array.isArray(rows) && rows.length > 0) {
          const socExact = rows.find((r) => r.soc.toLowerCase() === q);
          const rec = socExact || rows.find((r) => r.title.toLowerCase().includes(q)) || rows[0];
          if (rec) {
            return {
              matchedSocCode: rec.soc,
              matchedSocTitle: rec.title,
              areaName: rec.areaName,
              unit: "hourly",
              wages: {
                level1: Number(rec.level1),
                level2: Number(rec.level2),
                level3: Number(rec.level3),
                level4: Number(rec.level4),
              },
            };
          }
        }
      }
    } catch (_e) {
      // ignore and fallback
    }
  }

  // Fallback to cached JSON index from filesystem if present
  const index = await readIndex();
  if (index && index.length > 0) {
    const pool = req.areaCode
      ? index.filter((r) => r.areaCode === req.areaCode)
      : index;
    const exact = pool.find((r) => r.soc.toLowerCase() === q);
    const rec: IndexRecord | undefined =
      exact || pool.find((r) => r.title.toLowerCase().includes(q)) || pool[0];
    if (rec) {
      return {
        matchedSocCode: rec.soc,
        matchedSocTitle: rec.title,
        areaName: rec.areaName,
        unit: "hourly",
        wages: {
          level1: rec.level1,
          level2: rec.level2,
          level3: rec.level3,
          level4: rec.level4,
        },
      };
    }
  }

  // Fallback to mock
  const mock = bestMatchBySocOrTitleFromMock(req.socOrTitle);
  return {
    matchedSocCode: mock.soc,
    matchedSocTitle: mock.title,
    areaName: mock.area,
    unit: "hourly",
    wages: mock.wages,
  };
}
