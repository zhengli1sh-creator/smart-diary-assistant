import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { chatMessages, diaryEntries, users } from '@/lib/db/schema';
import { and, gte, lte, eq } from 'drizzle-orm';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { saveMemories, saveTasks } from '@/lib/db/memory-service';

export const maxDuration = 60; // Allow more time for LLM processing

// Initialize the OpenAI provider with DeepSeek's base URL inside the handler to support local scripting


const ExtractionSchema = z.object({
  memories: z.array(
    z.object({
      category: z.enum(['study', 'work', 'life', 'general']),
      type: z.enum(['fact', 'preference', 'goal', 'ongoing_project']),
      content: z.string().describe('A concise sentence describing the extracted memory fact or preference.'),
    })
  ).describe('List of structural memories extracted from the user\'s daily logs'),
  tasks: z.array(
    z.object({
      title: z.string().describe('Actionable to-do task title'),
      dueDate: z.string().describe('ISO format YYYY-MM-DD, or empty/null if unknown').nullable().optional(),
    })
  ).describe('List of actionable tasks the user mentioned they need to complete'),
});

export async function GET(req: Request) {
  // Simple auth for the cron job
  const authHeader = req.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    // In local dev, we might hit this directly without secret, so we can temporarily allow if NO secret is set.
    if (process.env.NODE_ENV === 'production') {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const deepseek = createOpenAI({
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
  });

  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get('date');
    const targetDate = dateParam || new Date().toISOString().split('T')[0];
    
    // Convert targetDate to millisecond boundaries for accurate querying
    const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
    const endOfDay = new Date(`${targetDate}T23:59:59.999Z`);

    // 1. Get all users
    const allUsers = await db.select().from(users);
    
    const results = [];

    // 2. Iterate each user to extract memories
    for (const user of allUsers) {
      // Get chat messages for this day
      const dailyChats = await db
        .select()
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.userId, user.id),
            gte(chatMessages.createdAt, startOfDay),
            lte(chatMessages.createdAt, endOfDay)
          )
        );

      // Get diary entries for this day
      const dailyDiaries = await db
        .select()
        .from(diaryEntries)
        .where(
          and(
            eq(diaryEntries.userId, user.id),
            eq(diaryEntries.date, targetDate)
          )
        );

      if (dailyChats.length === 0 && dailyDiaries.length === 0) {
        continue; // No activity today
      }

      // Compile content
      const compiledText = [
        '### Chat Logs ###',
        ...dailyChats.map(c => `[${new Date(c.createdAt).toISOString()}] ${c.role.toUpperCase()}: ${c.content}`),
        '\n### Diary Entries ###',
        ...dailyDiaries.map(d => `[Category: ${d.category}] -> ${d.content}`),
      ].join('\n');

      // 3. Call DeepSeek with structured output
      const { object } = await generateObject({
        model: deepseek('deepseek-chat'),
        schema: ExtractionSchema,
        prompt: `You are an AI assistant that extracts long-term structural memories and to-do tasks from the user's daily activity logs.
Your job is to read the chat logs and diary entries for today, and extract high-value facts, user preferences, long-term goals, and actionable to-do items.

Only extract things that are worth remembering for future conversations (e.g. "User's wife's name is Alice", "User prefers studying python in the morning", "User is working on a Next.js project"). 
For tasks, extract only explicit future intentions (e.g. "I need to call mom tomorrow" -> {title: "Call mom", dueDate: "tomorrow's date"}).

User Logs for ${targetDate}:
${compiledText}
`,
      });

      // 4. Save to DB
      if (object.memories.length > 0) {
        console.log(`[DEBUG] Saving ${object.memories.length} memories for userId: ${user.id}`);
        const memoryItems = object.memories.map(m => ({
          ...m,
          date: targetDate,
        }));
        await saveMemories(user.id, memoryItems);
      }

      if (object.tasks.length > 0) {
        const parsedTasks = object.tasks.map(t => ({
          title: t.title,
          dueDate: t.dueDate ?? undefined,
        }));
        await saveTasks(user.id, parsedTasks);
      }

      results.push({
        userId: user.id,
        memories: object.memories.length,
        tasks: object.tasks.length,
      });
    }

    return NextResponse.json({ success: true, processed: results });
  } catch (err: unknown) {
    console.error('[Extract Memories Error]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
