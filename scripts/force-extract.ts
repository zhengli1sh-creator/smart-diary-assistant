import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { createClient } from "@libsql/client";
import { randomUUID } from 'crypto';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const deepseek = createOpenAI({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY || '',
});

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

async function main() {
  const targetDate = '2026-03-08';
  console.log(`\n=== Running Raw Memory Extraction for ${targetDate} ===`);
  
  // Find users with diaries on this date
  const diariesRes = await client.execute({
    sql: "SELECT * FROM diary_entries WHERE date = ?",
    args: [targetDate]
  });

  if (diariesRes.rows.length === 0) {
    console.log("No diaries found.");
    return;
  }

  // Group by userId
  const userDiaries: Record<string, string[]> = {};
  for (const row of diariesRes.rows) {
    const uid = row.userId as string;
    if (!userDiaries[uid]) userDiaries[uid] = [];
    userDiaries[uid].push(`[Category: ${row.category}] -> ${row.content}`);
  }

  for (const [userId, diaries] of Object.entries(userDiaries)) {
    console.log(`Processing ${diaries.length} diaries for user ${userId}`);
    const compiledText = `### Diary Entries ###\n${diaries.join('\n')}`;

    console.log("Calling DeepSeek...");
    const { object } = await generateObject({
      model: deepseek('deepseek-chat'),
      schema: ExtractionSchema,
      prompt: `You are an AI assistant that extracts long-term structural memories and to-do tasks from the user's daily activity logs.\nUser Logs for ${targetDate}:\n${compiledText}`,
    });

    if (object.memories.length > 0) {
      console.log(`Inserting ${object.memories.length} memories into DB...`);
      for (const m of object.memories) {
        await client.execute({
          sql: "INSERT INTO structured_memories (id, userId, category, type, content, date, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
          args: [randomUUID(), userId, m.category, m.type, m.content, targetDate, Date.now()]
        });
      }
      console.log("Insert success!");
    }
  }
}

main().catch(console.error);
