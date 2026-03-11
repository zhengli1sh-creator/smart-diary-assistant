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
      content: z.string().describe('一条简短且客观的中文陈述，描述提取出的事实或偏好。务必使用中文。'),
    })
  ).describe('从用户日志中提取的结构化记忆列表'),
  tasks: z.array(
    z.object({
      title: z.string().describe('具体可执行的待办任务标题，使用中文。'),
      dueDate: z.string().describe('ISO 格式 YYYY-MM-DD，如果未知则为 null').nullable().optional(),
    })
  ).describe('从用户日志中提取的待办任务列表'),
});

async function main() {
  const targetDate = '2026-03-10';
  console.log(`\n=== Raw Memory Extraction for ${targetDate} ===`);
  
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
      prompt: `你是一个 AI 助手，负责从用户的每日日志中提取长期结构化记忆和待办任务。
你的任务是阅读当天的聊天记录和日记，提取出高价值的事实、用户偏好、长期目标以及可执行的待办事项。

**核心指令：**
1. 必须使用 **简体中文** 进行提取和总结。
2. 只提取值得长期记住的信息。

用户日志日期 ${targetDate}:
${compiledText}`,
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
