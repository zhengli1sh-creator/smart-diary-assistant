import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { db } from '@/lib/db';
import { GET } from '@/app/api/cron/extract-memories/route';
import { NextRequest } from 'next/server';

// Mock request to trigger the GET handler for a specific date
async function runForDate(dateStr: string) {
  console.log(`\n\n=== Running Memory Extraction for ${dateStr} ===`);
  const req = new NextRequest(`http://localhost:3000/api/cron/extract-memories?date=${dateStr}`);
  // Bypass authorization by mocking NODE_ENV or directly calling it
  const res = await GET(req);
  const data = await res.json();
  console.log(`Result for ${dateStr}:`, data);
}

async function main() {
  // Extract memories for the last 3 days where the user was active
  await runForDate('2026-03-07');
  await runForDate('2026-03-08');
  await runForDate('2026-03-09');
  console.log('\n✅ All historical memory extractions complete.');
  process.exit(0);
}

main().catch(console.error);
