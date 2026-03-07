import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const res = await db.all(sql`SELECT 1 as result;`);
    
    return NextResponse.json({ 
      ok: true, 
      result: res,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: 'Select failed', details: err?.message });
  }
}
