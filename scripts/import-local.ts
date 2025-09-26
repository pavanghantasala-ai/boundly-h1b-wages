#!/usr/bin/env ts-node

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { prisma } from '../src/lib/prisma';
import { buildIndexFromExtracted, indexRecordsToDbRows } from '../src/lib/ingest';

function parseArgs() {
  const args = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--dir') out.dir = args[++i];
    else if (a === '--year') out.year = args[++i];
  }
  return out as { dir?: string; year?: string };
}

async function main() {
  const { dir, year } = parseArgs();
  if (!dir || !year) {
    console.error('Usage: ts-node scripts/import-local.ts --dir <extracted_dir> --year <YYYY-YY>');
    process.exit(1);
  }
  const abs = path.resolve(dir);
  if (!fs.existsSync(abs)) {
    console.error(`Directory not found: ${abs}`);
    process.exit(1);
  }
  console.log(`Importing from directory: ${abs}`);
  console.log(`Target year: ${year}`);

  // Build index from local extracted CSVs
  const built = await buildIndexFromExtracted(abs);
  console.log(`Parsed records: ${built.count}`);

  // Replace rows for the year
  console.log(`Deleting existing rows for year ${year}...`);
  await prisma.wageIndex.deleteMany({ where: { year } });

  const rows = indexRecordsToDbRows(year, built.records);
  console.log(`Inserting ${rows.length} rows in batches...`);
  const batchSize = 1000;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await prisma.wageIndex.createMany({ data: batch, skipDuplicates: true });
    inserted += batch.length;
    if (inserted % (batchSize * 5) === 0 || i + batchSize >= rows.length) {
      console.log(`Inserted ${inserted}/${rows.length}`);
    }
  }

  // Report a few samples
  console.log('Sample records:', built.samples.slice(0, 3));
  console.log('Done.');
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
