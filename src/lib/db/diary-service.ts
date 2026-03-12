/**
 * Database service layer for diary operations.
 * Provides save and query functions for the AI's tool calling.
 */
import { db } from '@/lib/db';
import { chatMessages, diaryEntries } from '@/lib/db/schema';
import { eq, and, gte, lte, like, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export type DiaryCategory = 'study' | 'work' | 'life' | 'general';

export interface DiaryEntry {
  id: string;
  category: DiaryCategory;
  content: string;
  mood?: string | null;
  date: string;
  summary?: string | null;
  createdAt: number;
}

/**
 * Save a diary entry to the database.
 */
export async function saveDiaryEntry(
  userId: string,
  entry: {
    category: DiaryCategory;
    content: string;
    mood?: string;
    date: string; // YYYY-MM-DD
    summary?: string;
  },
): Promise<DiaryEntry> {
  const id = randomUUID();
  const now = new Date();

  await db.insert(diaryEntries).values({
    id,
    userId,
    category: entry.category,
    content: entry.content,
    mood: entry.mood ?? null,
    tags: '[]',
    date: entry.date || now.toISOString().split('T')[0],
    summary: entry.summary ?? null,
    createdAt: now,
  });

  return {
    id,
    category: entry.category,
    content: entry.content,
    mood: entry.mood,
    date: entry.date,
    summary: entry.summary,
    createdAt: now.getTime(),
  };
}

/**
 * Update an existing diary entry in the database.
 */
export async function updateDiaryEntry(
  id: string,
  userId: string,
  entry: {
    category?: DiaryCategory;
    content?: string;
    mood?: string;
    date?: string;
    summary?: string;
  },
): Promise<{ id: string }> {
  const updateData: Partial<typeof diaryEntries.$inferInsert> = {};
  if (entry.category) updateData.category = entry.category;
  if (entry.content) updateData.content = entry.content;
  if (entry.mood !== undefined) updateData.mood = entry.mood;
  if (entry.date) updateData.date = entry.date;
  if (entry.summary !== undefined) updateData.summary = entry.summary;

  if (Object.keys(updateData).length === 0) {
    throw new Error('未提供可更新字段');
  }

  const existing = await db
    .select({ id: diaryEntries.id })
    .from(diaryEntries)
    .where(and(eq(diaryEntries.id, id), eq(diaryEntries.userId, userId)))
    .limit(1);

  if (existing.length === 0) {
    throw new Error('未找到可更新的日记记录，可能 ID 不存在或不属于当前用户');
  }

  await db.update(diaryEntries)
    .set(updateData)
    .where(
      and(
        eq(diaryEntries.id, id),
        eq(diaryEntries.userId, userId)
      )
    );

  return { id };
}


/**
 * Query diary entries with optional filters.
 * @param userId - The user's ID
 * @param opts   - Filter options: category, startDate, endDate, keyword
 */
export async function queryDiaryEntries(
  userId: string,
  opts: {
    category?: DiaryCategory;
    startDate?: string; // YYYY-MM-DD
    endDate?: string;   // YYYY-MM-DD
    keyword?: string;
  } = {},
): Promise<DiaryEntry[]> {
  const conditions = [eq(diaryEntries.userId, userId)];

  if (opts.category) {
    conditions.push(eq(diaryEntries.category, opts.category));
  }
  if (opts.startDate) {
    conditions.push(gte(diaryEntries.date, opts.startDate));
  }
  if (opts.endDate) {
    conditions.push(lte(diaryEntries.date, opts.endDate));
  }
  if (opts.keyword) {
    conditions.push(like(diaryEntries.content, `%${opts.keyword}%`));
  }

  const rows = await db
    .select()
    .from(diaryEntries)
    .where(and(...conditions))
    .orderBy(desc(diaryEntries.createdAt))
    .limit(20);

  return rows.map((r) => ({
    id: r.id,
    category: r.category as DiaryCategory,
    content: r.content,
    mood: r.mood,
    date: r.date,
    summary: r.summary,
    createdAt: r.createdAt.getTime(),
  }));
}

/**
 * Save a chat message to the DB (for history persistence).
 */
export async function saveChatMessage(
  userId: string,
  role: 'user' | 'assistant',
  content: string,
) {
  try {
    await db.insert(chatMessages).values({
      id: randomUUID(),
      userId,
      role,
      content,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to save chat message:', error);
  }
}

/**
 * Get recent chat messages for a user.
 */
export async function getChatMessages(userId: string, limit: number = 50) {
  try {
    const rows = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    // Return in chronological order
    return rows.reverse().map(r => ({
      id: r.id,
      role: r.role,
      content: r.content,
    }));
  } catch (error) {
    console.error('Failed to get chat messages:', error);
    return [];
  }
}
