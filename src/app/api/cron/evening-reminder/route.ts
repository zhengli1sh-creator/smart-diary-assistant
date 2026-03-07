import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { diaryEntries, users } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { createCalendarEvent } from '@/lib/google/calendar';

export const maxDuration = 60; // Allow more time for external API calls

export async function GET(req: Request) {
  // Simple auth for the cron job
  const authHeader = req.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    if (process.env.NODE_ENV === 'production') {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  try {
    const url = new URL(req.url);
    const runTypeParam = url.searchParams.get('type');
    
    // Determine target time boundaries
    const nowLocal = new Date();
    // Use Singapore/China timezone to determine the local date (UTC+8)
    const formatter = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
    const localDateStr = formatter.format(nowLocal); // returns YYYY-MM-DD
    
    // Default to 8pm ('20') or 11pm ('23') logic based on current UTC+8 hour
    const localHour = parseInt(
      new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', hour: '2-digit', hourCycle: 'h23' }).format(nowLocal),
      10
    );
    
    const targetType = runTypeParam || (localHour >= 22 ? '23' : '20');

    // 1. Get all users
    const allUsers = await db.select().from(users);
    
    const results = [];

    // 2. Iterate each user to check daily diary
    for (const user of allUsers) {
      // Get diary entries for today
      const dailyDiaries = await db
        .select()
        .from(diaryEntries)
        .where(
          and(
            eq(diaryEntries.userId, user.id),
            eq(diaryEntries.date, localDateStr)
          )
        );

      if (dailyDiaries.length > 0) {
        // User already wrote a diary today, skip reminding
        continue;
      }

      // 3. User hasn't written a diary -> Create Calendar Reminder
      // Create a 30-minute block immediately from current time so they get a prompt push notification
      const eventStart = new Date(); // now
      const eventEnd = new Date(eventStart.getTime() + 30 * 60000); // +30 mins
      
      const title =
        targetType === '23'
          ? '🚨 [最后提醒] 今天还没有记日记哦，马上就12点了！'
          : '🔔 [晚间提醒] 忙碌一天啦，快来和 Smart Diary 聊聊今天吧~';
          
      const description = `点击此处回顾今天：${process.env.NEXTAUTH_URL || 'http://localhost:3001'}`;

      try {
        const event = await createCalendarEvent(user.id, {
          title,
          start: eventStart.toISOString(),
          end: eventEnd.toISOString(),
          description,
        });
        
        results.push({ userId: user.id, reminded: true, eventId: event.id, type: targetType });
      } catch (err) {
        console.error(`Failed to send reminder to user: ${user.id}`, err);
        results.push({ userId: user.id, reminded: false, error: String(err) });
      }
    }

    return NextResponse.json({ success: true, processed: results });
  } catch (err: unknown) {
    console.error('[Evening Reminder Error]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
