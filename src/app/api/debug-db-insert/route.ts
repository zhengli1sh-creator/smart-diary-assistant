import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const schemaRows = await db.all(
      sql`SELECT sql FROM sqlite_master WHERE type='table' AND name='chat_messages';`
    ) as any[];
    
    return NextResponse.json({ 
      ok: true, 
      schema: schemaRows[0]?.sql || 'No table found',
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: 'Select failed', details: err?.message });
  }
}
