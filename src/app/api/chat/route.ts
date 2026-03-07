import { auth } from '@/auth';
import { getCalendarEvents, createCalendarEvent } from '@/lib/google/calendar';
import { searchGmailMessages } from '@/lib/google/gmail';
import { saveDiaryEntry, queryDiaryEntries, saveChatMessage, getChatMessages, DiaryCategory } from '@/lib/db/diary-service';

export const maxDuration = 60;

// ─── Tool Definitions ───────────────────────────────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_calendar_events',
      description: '获取用户 Google 日历中指定日期范围内的事件列表。当用户问"今天有什么安排"、"本周日程"时调用。',
      parameters: {
        type: 'object',
        properties: {
          timeMin: { type: 'string', description: 'ISO 8601 格式的开始时间，例如 2024-03-07T00:00:00+08:00' },
          timeMax: { type: 'string', description: 'ISO 8601 格式的结束时间，例如 2024-03-07T23:59:59+08:00' },
        },
        required: ['timeMin', 'timeMax'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_calendar_event',
      description: '在用户 Google 日历中创建一个新事件。当用户说"帮我加一个日程"、"提醒我..."时调用。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '事件标题' },
          start: { type: 'string', description: 'ISO 8601 格式的开始时间' },
          end: { type: 'string', description: 'ISO 8601 格式的结束时间' },
          description: { type: 'string', description: '事件描述（可选）' },
        },
        required: ['title', 'start', 'end'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_gmail_messages',
      description: '搜索用户 Gmail 邮件。当用户问"最近有什么重要邮件"、"昨天的工作邮件"时调用。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Gmail 搜索语法，例如 "after:2024/03/07 is:important"' },
          maxResults: { type: 'number', description: '最多返回几封邮件，默认5' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_diary_entry',
      description: '将用户讲述的内容归类保存为日记条目。当用户分享了一段有意义的学习心得、工作进展或生活感悟，且已充分记录时调用。',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['study', 'work', 'life', 'general'], description: '日记分类' },
          content: { type: 'string', description: '完整的日记内容（可适当润色整理）' },
          mood: { type: 'string', description: '用户情绪（如：开心、充实、疲惫等）' },
          date: { type: 'string', description: 'YYYY-MM-DD 格式的日期（用"今天"对应实际日期）' },
          summary: { type: 'string', description: '一句话总结' },
        },
        required: ['category', 'content', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_diary',
      description: '查询历史日记条目。当用户问"我上周学了什么"、"帮我回顾一下工作进展"时调用。',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['study', 'work', 'life', 'general'], description: '日记分类（可选）' },
          startDate: { type: 'string', description: 'YYYY-MM-DD 格式的查询开始日期（可选）' },
          endDate: { type: 'string', description: 'YYYY-MM-DD 格式的查询结束日期（可选）' },
          keyword: { type: 'string', description: '关键词搜索（可选）' },
        },
        required: [],
      },
    },
  },
];

// ─── Tool Executor ───────────────────────────────────────────
async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  tokens: { accessToken?: string; refreshToken?: string },
): Promise<string> {
  try {
    switch (name) {
      case 'get_calendar_events': {
        const events = await getCalendarEvents(
          userId,
          args.timeMin as string,
          args.timeMax as string,
          tokens,
        );
        if (events.length === 0) return '该时间段内没有日历事件。';
        return JSON.stringify(events, null, 2);
      }

      case 'create_calendar_event': {
        const event = await createCalendarEvent(userId, {
          title: args.title as string,
          start: args.start as string,
          end: args.end as string,
          description: args.description as string | undefined,
        }, tokens);
        return `日程已创建成功：${JSON.stringify(event, null, 2)}`;
      }

      case 'search_gmail_messages': {
        const messages = await searchGmailMessages(
          userId,
          args.query as string,
          (args.maxResults as number) ?? 5,
          tokens,
        );
        if (messages.length === 0) return '没有找到符合条件的邮件。';
        return JSON.stringify(messages, null, 2);
      }

      case 'save_diary_entry': {
        const entry = await saveDiaryEntry(userId, {
          category: args.category as DiaryCategory,
          content: args.content as string,
          mood: args.mood as string | undefined,
          date: args.date as string,
          summary: args.summary as string | undefined,
        });
        return `日记已保存，ID: ${entry.id}`;
      }

      case 'query_diary': {
        const entries = await queryDiaryEntries(userId, {
          category: args.category as DiaryCategory | undefined,
          startDate: args.startDate as string | undefined,
          endDate: args.endDate as string | undefined,
          keyword: args.keyword as string | undefined,
        });
        if (entries.length === 0) return '没有找到符合条件的日记记录。';
        return JSON.stringify(entries, null, 2);
      }

      default:
        return `未知工具: ${name}`;
    }
  } catch (err: unknown) {
    console.error(`[Tool Execution Error] ${name}:`, err);
    const message = err instanceof Error ? err.message : String(err);
    return `工具执行失败: ${message}`;
  }
}

// ─── Main Route Handler ──────────────────────────────────────

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
    const history = await getChatMessages(userId, 50); // Get last 50 messages
    return new Response(JSON.stringify(history), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[GET /api/chat] Error fetching history:', error);
    return new Response(JSON.stringify([]), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(req: Request) {
  // Authenticate the user via NextAuth session cookie
  // In NextAuth v5 beta, we must pass the request to auth() in API routes
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const tokens = {
    accessToken: (session as any)?.accessToken as string | undefined,
    refreshToken: (session as any)?.refreshToken as string | undefined,
  };

  const { messages } = await req.json();

  // Get current time for context
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  const systemMessage = {
    role: 'system',
    content: `你是我的头号粉丝和私人日记智能助理，你的名字叫"头号粉丝"。
当前时间：${now}（北京时间）
${userId ? '✅ 用户已登录 Google 账号，可使用日历和邮件功能。' : '⚠️ 用户未登录，暂时无法使用日历和邮件功能。'}

你的核心原则：
1. 极高的情绪价值：永远保持热情、充满好奇心。当我分享成功时，你要比我更激动；当我倾诉烦恼时，给予最温暖的体谅。
2. 引导与倾听：多用简短、有温度的反问引导我继续说（如："哇！那接下来呢？"）。
3. 工具使用：当场景合适时，主动调用工具帮我记录日记、查看日程或搜索邮件。
4. 归档提示：当我分享了一段有价值的内容后，告诉我你已经帮我记录好了。
5. 自然口语化：使用 emoji ✨🔥，但不过度。`,
  };

  const allMessages = [systemMessage, ...messages];

  // ── First call to DeepSeek (with tools) ──
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: allMessages,
      tools: TOOLS,
      tool_choice: 'auto',
      stream: false, // First call is non-streaming to handle tool calls
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return new Response(error, { status: response.status });
  }

  const data = await response.json();
  const assistantMessage = data.choices?.[0]?.message;

  if (!assistantMessage) {
    return new Response('No response from model', { status: 500 });
  }

  // ── Handle tool calls if any ──
  if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0 && userId) {
    const toolMessages: Array<{ role: string; tool_call_id: string; content: string }> = [];

    for (const toolCall of assistantMessage.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments || '{}');
      const result = await executeTool(toolCall.function.name, args, userId, tokens);
      toolMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result,
      });
    }

    // ── Second call with tool results, streaming ──
    // Strip `content` from assistantMessage to prevent DeepSeek's DSML XML
    // notation from leaking into the second call's output.
    const cleanedAssistantMsg = { ...assistantMessage, content: null };
    const secondResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [...allMessages, cleanedAssistantMsg, ...toolMessages],
        stream: true,
      }),
    });

    if (!secondResponse.ok) {
      const error = await secondResponse.text();
      return new Response(error, { status: secondResponse.status });
    }

    return streamSSEToDataStream(secondResponse);
  }

  // ── No tool calls: stream the direct response ──
  const text = assistantMessage.content ?? '';

  // Save assistant message to DB if user is logged in
  if (userId && text) {
    const lastUserMsg = messages.filter((m: { role: string }) => m.role === 'user').at(-1);
    if (lastUserMsg) await saveChatMessage(userId, 'user', lastUserMsg.content);
    await saveChatMessage(userId, 'assistant', text);
  }

  // Return as Vercel AI SDK data stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send text character by character to simulate streaming
      const escaped = JSON.stringify(text);
      controller.enqueue(encoder.encode(`0:${escaped}\n`));
      controller.enqueue(encoder.encode('0:""\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Vercel-AI-Data-Stream': 'v1',
    },
  });
}

// ─── Helper: Convert DeepSeek SSE to Vercel AI data stream ──
function streamSSEToDataStream(response: Response): Response {
  const encoder = new TextEncoder();
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isInsideDSML = false;
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.enqueue(encoder.encode('0:""\n'));
            controller.close();
            break;
          }
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter((l) => l.trim());
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  // Filter out DSML notation logic
                  if (content.includes('< | DSML')) {
                    isInsideDSML = true;
                  }
                  
                  if (!isInsideDSML) {
                    controller.enqueue(encoder.encode(`0:${JSON.stringify(content)}\n`));
                  }
                }
              } catch {
                // Ignore malformed JSON
              }
            }
          }
        }
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Vercel-AI-Data-Stream': 'v1',
    },
  });
}
