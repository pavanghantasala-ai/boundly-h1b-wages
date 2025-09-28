import { promises as fs } from "fs";
import path from "path";
import os from "os";

// Use a writable location in serverless (e.g., Vercel). project dir is read-only
const DATA_DIR = process.env.DATA_DIR
  ? process.env.DATA_DIR
  : process.env.VERCEL || process.env.NODE_ENV === "production"
  ? path.join(os.tmpdir(), "boundly-data")
  : path.join(process.cwd(), ".data");
const INDEX_FILE = path.join(DATA_DIR, "oflc_index.json");

export type IndexRecord = {
  soc: string;
  title: string;
  areaCode: string;
  areaName: string;
  unit: "hourly";
  level1: number;
  level2: number;
  level3: number;
  level4: number;
};

export async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function readIndex(): Promise<IndexRecord[] | null> {
  try {
    const buf = await fs.readFile(INDEX_FILE, "utf8");
    const json = JSON.parse(buf);
    if (Array.isArray(json)) return json as IndexRecord[];
    return null;
  } catch (e) {
    return null;
  }
}

export async function writeIndex(records: IndexRecord[]) {
  await ensureDataDir();
  await fs.writeFile(INDEX_FILE, JSON.stringify(records, null, 2), "utf8");
}

export function dataInfo() {
  return { DATA_DIR, INDEX_FILE };
}
