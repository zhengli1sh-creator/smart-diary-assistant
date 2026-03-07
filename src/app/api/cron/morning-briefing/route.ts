import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tasks, users } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { createCalendarEvent, getCalendarEvents } from '@/lib/google/calendar';

export const maxDuration = 60; // Allow more time for external API calls

/**
 * Helper: Check DeepSeek API balance
 */
async function checkDeepSeekBalance(): Promise<string> {
  try {
    const res = await fetch('https://api.deepseek.com/user/balance', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
    });
    
    if (!res.ok) {
      console.warn('Failed to fetch DeepSeek balance:', res.statusText);
      return '';
    }
    
    const data = await res.json();
    if (data && data.is_available && data.balance_infos && data.balance_infos.length > 0) {
      // Find CNY balance or first available
      const cnyInfo = data.balance_infos.find((b: { currency: string }) => b.currency === 'CNY') || data.balance_infos[0];
      const total = parseFloat(cnyInfo.total_balance);
      
      if (total < 20) {
        return `⚠️ 警告: DeepSeek 账户余额不足 20 ${cnyInfo.currency} (当前: ${total})，请及时充值！`;
      }
      return `当前大模型余额: ${total} ${cnyInfo.currency}`;
    }
  } catch (err) {
    console.error('Error checking DeepSeek balance:', err);
  }
  return '';
}

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
    const nowLocal = new Date();
    // Use Singapore/China timezone to determine the local date (UTC+8)
    const formatter = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
    const localDateStr = formatter.format(nowLocal); // returns YYYY-MM-DD
    
    // 1. Check DeepSeek balance early
    const balanceAlert = await checkDeepSeekBalance();

    // 2. Get all users
    const allUsers = await db.select().from(users);
    const results = [];

    // 3. Iterate each user to generate Morning Briefing as an all-day calendar event
    for (const user of allUsers) {
      // Get today's agenda from google calendar to include in the briefing
      let agendaSummary = '';
      try {
        const startOfDay = new Date(`${localDateStr}T00:00:00+08:00`);
        const endOfDay =   new Date(`${localDateStr}T23:59:59+08:00`);
        const events = await getCalendarEvents(user.id, startOfDay.toISOString(), endOfDay.toISOString());
        
        if (events && events.length > 0) {
          agendaSummary = "📅 今日日程:\n" + events.map(e => `- ${e.title} (${e.start.includes('T') ? new Date(e.start).toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'}) : '全天'})`).join('\n');
        } else {
          agendaSummary = "📅 今日暂无固定日程安排。";
        }
      } catch (e) {
        console.error("Failed to fetch agenda for user", user.id, e);
        // Note: this also serves as the Google Service Health Check.
        // If it throws an auth error, we could ping the frontend here via web-socket or DB flag to show a banner.
        agendaSummary = "⚠️ 无法获取您的 Google 日历。可能是授权已过期，请回主应用重新登录授权。";
      }

      // Get pending tasks
      const pendingTasks = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, user.id),
            eq(tasks.status, 'pending')
          )
        );

      let taskSummary = '';
      if (pendingTasks.length > 0) {
        taskSummary = "✅ 待办事项:\n" + pendingTasks.map(t => `- ${t.title}` + (t.dueDate ? ` (截止: ${t.dueDate})` : '')).join('\n');
      } else {
        taskSummary = "✅ 当前没有未完成的待办事项。";
      }

      // Combine into a single body for the calendar description
      const descriptionParts = [
        "早安！这是您今天的全天摘要：\n",
        agendaSummary,
        "\n",
        taskSummary
      ];
      
      if (balanceAlert) {
        descriptionParts.push(`\n---\n🛠 系统公告: \n${balanceAlert}`);
      }
      
      const fullDescription = descriptionParts.join('\n');

      try {
        // Insert an All-Day event into Google Calendar acts as the "Morning Report" notification
        // createCalendarEvent currently expects dateTime ISO strings.
        const briefingStart = new Date(`${localDateStr}T08:00:00+08:00`);
        const briefingEnd = new Date(`${localDateStr}T08:30:00+08:00`);

        const briefingEvent = await createCalendarEvent(user.id, {
          title: "🌅 Smart Diary 早报",
          start: briefingStart.toISOString(),
          end: briefingEnd.toISOString(),
          description: fullDescription,
        });
        
        results.push({ userId: user.id, briefed: true, eventId: briefingEvent.id });
      } catch (err) {
        console.error(`Failed to send morning briefing to user: ${user.id}`, err);
        results.push({ userId: user.id, briefed: false, error: String(err) });
      }
    }

    return NextResponse.json({ success: true, processed: results });
  } catch (err: unknown) {
    console.error('[Morning Briefing Error]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
