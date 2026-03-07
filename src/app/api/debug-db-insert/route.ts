import { db } from "@/lib/db";
import { chatMessages } from "@/lib/db/schema";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || 'test-user-id';

  try {
    await db.insert(chatMessages).values({
      id: randomUUID(),
      userId,
      role: 'user',
      content: 'Debug message ' + Date.now(),
      createdAt: new Date(),
    });
    return NextResponse.json({ ok: true, message: 'Insert successful' });
  } catch (err: any) {
    return NextResponse.json({ 
      ok: false, 
      error: 'Insert failed', 
      details: err?.message || String(err),
      stack: err?.stack,
    });
  }
}
