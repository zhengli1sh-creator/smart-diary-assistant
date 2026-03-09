import { db } from '@/lib/db';
import { structuredMemories, tasks } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export type MemoryCategory = 'study' | 'work' | 'life' | 'general';
export type MemoryType = 'fact' | 'preference' | 'goal' | 'ongoing_project';

export interface SaveMemoryParams {
  category: MemoryCategory;
  type: MemoryType;
  content: string;
  date: string;
}

/**
 * Save extracted structured memories to the database.
 */
export async function saveMemories(userId: string, memories: SaveMemoryParams[]) {
  if (memories.length === 0) return;
  const values = memories.map(m => ({
    id: randomUUID(),
    userId,
    category: m.category,
    type: m.type,
    content: m.content,
    date: m.date,
    createdAt: new Date(),
  }));
  await db.insert(structuredMemories).values(values);
}

/**
 * Get extracted structured memories for a user.
 */
export async function getMemories(userId: string) {
  return await db.select().from(structuredMemories)
    .where(eq(structuredMemories.userId, userId))
    .orderBy(desc(structuredMemories.createdAt));
}

export interface SaveTaskParams {
  title: string;
  dueDate?: string; // ISO format
  status?: string; // 'pending' | 'completed'
  sourceDiaryId?: string;
}

/**
 * Save extracted tasks (to-do items) to the database.
 */
export async function saveTasks(userId: string, taskItems: SaveTaskParams[]) {
  if (taskItems.length === 0) return;
  const values = taskItems.map(t => ({
    id: randomUUID(),
    userId,
    title: t.title,
    dueDate: t.dueDate ?? null,
    status: t.status ?? 'pending',
    sourceDiaryId: t.sourceDiaryId ?? null,
    createdAt: new Date(),
  }));
  await db.insert(tasks).values(values);
}
