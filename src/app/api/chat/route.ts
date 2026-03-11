import { auth } from '@/auth';
import { getCalendarEvents, createCalendarEvent } from '@/lib/google/calendar';
import { searchGmailMessages } from '@/lib/google/gmail';
import { saveDiaryEntry, updateDiaryEntry, queryDiaryEntries, saveChatMessage, getChatMessages, DiaryCategory } from '@/lib/db/diary-service';
import { streamText, tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

const deepseekOpenAI = createOpenAI({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY || '',
});

export const maxDuration = 120; // 允许后端接口最长运行 2 分钟，防止长对话被强行切断

export async function GET(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  if (!userId) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const messages = await getChatMessages(userId);
    return new Response(JSON.stringify(messages), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to get chat messages:', error);
    return new Response(JSON.stringify([]), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const tokens = {
    accessToken: (session as any)?.accessToken as string | undefined,
    refreshToken: (session as any)?.refreshToken as string | undefined,
  };

  const { messages } = await req.json();

  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  const systemMessage = `你是我的头号粉丝和私人日记智能助理，你的名字叫"头号粉丝"。
当前时间：${now}（北京时间）
${userId ? '✅ 用户已登录 Google 账号，可使用日历和邮件功能。' : '⚠️ 用户未登录，暂时无法使用日历和邮件功能。'}

⚠️ 记录可靠性铁律 (Vercel Hobby 10s 限制)：
1. **思维链思考 (Chain of Thought)**：在进行任何保存/更新操作前，必须进行内部逻辑判断并在输出最开始简要同步。例如：“检测到补充信息，正在检查历史记录...”
2. **先查后改 (Query Before Update)**：如果用户提到“补充、更新、刚才说、那件事、修改”等，禁用直接 \`save_diary_entry\`。你必须先调用 \`query_diary\` 获取最近一条记录的真正 ID，拿到 ID 后再调用 \`update_diary_entry\`。
3. **见 ID 才报喜**：绝对禁止在拿到工具返回的真实 ID 之前说“已保存”或使用 ✅ 表情。**禁止编造十六进制 ID**，虚假 ID 会导致系统灾难。
4. **工具优先流**：不要在流式起始进行长篇抒情。
5. **分步引导**：如果内容太多担心超时，先存入核心段落，并告知用户：“内容较多，核心部分已存入 ID:xxxx，剩下的请继续补充”。`;

  try {
    const result = await streamText({
      model: deepseekOpenAI('deepseek-chat'),
      system: systemMessage,
      messages: messages,
      maxTokens: 3000, 
      tools: {
        check_deepseek_balance: tool({
          description: '查询当前的 DeepSeek API 余额。当用户问"余额还有多少"、"查询余额"时调用。',
          parameters: z.object({}),
          execute: async () => {
            const start = Date.now();
            try {
              const res = await fetch('https://api.deepseek.com/user/balance', {
                headers: {
                  'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
                  'Accept': 'application/json'
                }
              });
              if (!res.ok) return "查询失败，请检查 API Key。";
              const data = await res.json();
              if (data && data.is_available !== undefined) {
                const totalBalance = data.balance_infos.reduce((sum: number, info: any) => sum + parseFloat(info.total_balance), 0);
                return `当前余额：${totalBalance.toFixed(2)} CNY（可用状态：${data.is_available ? '可用' : '不可用'}）`;
              }
              return "未能获取有效余额数据。";
            } finally {
              console.log(`[Tool: balance] Duration: ${Date.now() - start}ms`);
            }
          }
        }),
        get_calendar_events: tool({
          description: '获取用户 Google 日历中指定日期范围内的事件列表。当用户问"今天有什么安排"、"本周日程"时调用。',
          parameters: z.object({
            timeMin: z.string().describe('ISO 8601 格式的开始时间，例如 2024-03-07T00:00:00+08:00'),
            timeMax: z.string().describe('ISO 8601 格式的结束时间，例如 2024-03-07T23:59:59+08:00'),
          }),
          execute: async (args) => {
            const start = Date.now();
            if (!userId) return "用户未登录";
            const events = await getCalendarEvents(userId, args.timeMin, args.timeMax, tokens);
            console.log(`[Tool: get_calendar] Duration: ${Date.now() - start}ms`);
            return events.length === 0 ? '该时间段内没有日历事件。' : JSON.stringify(events);
          }
        }),
        create_calendar_event: tool({
          description: '在用户 Google 日历中创建一个新事件。当用户说"帮我加一个日程"、"提醒我..."时调用。',
          parameters: z.object({
            title: z.string().describe('事件标题'),
            start: z.string().describe('ISO 8601 格式的开始时间'),
            end: z.string().describe('ISO 8601 格式的结束时间'),
            description: z.string().optional().describe('事件描述（可选）'),
          }),
          execute: async (args) => {
            const start = Date.now();
            if (!userId) return "用户未登录";
            const event = await createCalendarEvent(userId, args as any, tokens);
            console.log(`[Tool: create_calendar] Duration: ${Date.now() - start}ms`);
            return `日程已创建成功：${JSON.stringify(event)}`;
          }
        }),
        search_gmail_messages: tool({
          description: '搜索用户 Gmail 邮件。当用户问"最近有什么重要邮件"、"昨天的工作邮件"时调用。',
          parameters: z.object({
            query: z.string().describe('Gmail 搜索语法，例如 "after:2024/03/07 is:important"'),
            maxResults: z.number().optional().describe('最多返回几封邮件，默认5'),
          }),
          execute: async (args) => {
            const start = Date.now();
            if (!userId) return "用户未登录";
            const result = await searchGmailMessages(userId, args.query, args.maxResults ?? 5, tokens);
            console.log(`[Tool: search_gmail] Duration: ${Date.now() - start}ms`);
            return result.length === 0 ? '没有找到符合条件的邮件。' : JSON.stringify(result);
          }
        }),
        save_diary_entry: tool({
          description: '将用户讲述的内容归类保存为日记条目。当用户分享了一段有意义的学习心得、工作进展或生活感悟，且已充分记录时调用。',
          parameters: z.object({
            category: z.enum(['study', 'work', 'life', 'general']).describe('日记分类'),
            content: z.string().describe('完整的日记内容（可适当润色整理）'),
            mood: z.string().optional().describe('用户情绪（如：开心、充实、疲惫等）'),
            date: z.string().describe('YYYY-MM-DD 格式的真实日期（例如 2026-03-08，绝对不能填"今天"）'),
            summary: z.string().optional().describe('一句话总结'),
          }),
          execute: async (args) => {
            const start = Date.now();
            if (!userId) return "用户未登录";
            const entry = await saveDiaryEntry(userId, args as any);
            console.log(`[Tool: save_diary] Duration: ${Date.now() - start}ms`);
            return `日记已保存，ID: ${entry.id}`;
          }
        }),
        update_diary_entry: tool({
          description: '更新或补充一条已存在的日记。如果是对刚才提到的话题补充细节，请传入刚才保存的日记的 ID 来合并内容，避免产生两条重复的日记。',
          parameters: z.object({
            id: z.string().describe('需要更新的日记的 ID'),
            category: z.enum(['study', 'work', 'life', 'general']).optional().describe('日记分类（如需修改）'),
            content: z.string().optional().describe('补充合并后的完整日记内容'),
            mood: z.string().optional().describe('最新的情绪状态'),
            date: z.string().optional().describe('YYYY-MM-DD 格式的真实日期'),
            summary: z.string().optional().describe('一句话总结'),
          }),
          execute: async (args) => {
            const start = Date.now();
            if (!userId) return "用户未登录";
            await updateDiaryEntry(args.id, userId, args as any);
            console.log(`[Tool: update_diary] Duration: ${Date.now() - start}ms`);
            return `日记更新成功，ID: ${args.id}`;
          }
        }),
        query_diary: tool({
          description: '查询历史日记条目。当用户问"我上周学了什么"、"帮我回顾一下工作进展"时调用。',
          parameters: z.object({
            category: z.enum(['study', 'work', 'life', 'general']).optional().describe('日记分类。如果不确定具体是哪类，请务必留空！'),
            startDate: z.string().optional().describe('YYYY-MM-DD 格式的查询开始日期（可选）'),
            endDate: z.string().optional().describe('YYYY-MM-DD 格式的查询结束日期（可选）'),
            keyword: z.string().optional().describe('关键词搜索（可选）。建议只有在查询极其模糊的事件时才填写。'),
          }),
          execute: async (args) => {
            const start = Date.now();
            if (!userId) return "用户未登录";
            const entries = await queryDiaryEntries(userId, args as any);
            console.log(`[Tool: query_diary] Duration: ${Date.now() - start}ms`);
            if (entries.length === 0) {
              return `数据库中没有找到符合条件的记录。(Debug提示：你使用的查询参数为 ${JSON.stringify(args)}，可能是过滤条件太严格，比如填了不存在的 category 或 keyword，请尝试清空它们再次查询！)`;
            }
            return JSON.stringify(entries);
          }
        })
      },
      maxSteps: 5, // Automatically allow the model to make consecutive tool calls before responding
      onFinish: async ({ text }) => {
        if (userId && text) {
          try {
            const lastUserMsg = messages.filter((m: any) => m.role === 'user').at(-1);
            if (lastUserMsg) await saveChatMessage(userId, 'user', lastUserMsg.content);
            await saveChatMessage(userId, 'assistant', text);
          } catch (e) {
            console.error("Failed to save conversation history", e);
          }
        }
      }
    });

    return result.toDataStreamResponse();
  } catch (err: any) {
    console.error("StreamText error:", err);
    return new Response(err?.message || "Internal Error", { status: 500 });
  }
}
