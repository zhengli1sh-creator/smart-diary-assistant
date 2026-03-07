import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    // List all tables in the database
    const tables = await db.run(sql`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
    return NextResponse.json({ ok: true, tables: tables.rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
