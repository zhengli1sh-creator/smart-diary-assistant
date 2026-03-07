import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: integer('emailVerified', { mode: 'timestamp_ms' }),
  image: text('image'),
});

export const accounts = sqliteTable('accounts', {
  userId: text('userId').notNull(),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (account) => ({
  compoundKey: primaryKey({ columns: [account.provider, account.providerAccountId] }),
}));

export const sessions = sqliteTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId').notNull(),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

export const verificationTokens = sqliteTable('verificationToken', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
}, (vt) => ({
  compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
}));

export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  role: text('role').notNull(), // 'user' | 'assistant' | 'system' | 'data'
  content: text('content').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
});

export const diaryEntries = sqliteTable('diary_entries', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  category: text('category').notNull(), // 'study', 'work', 'life'
  content: text('content').notNull(),
  mood: text('mood'),
  tags: text('tags'), // Stored as JSON string []
  date: text('date').notNull(), // YYYY-MM-DD for fast querying
  summary: text('summary'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
});

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  title: text('title').notNull(),
  dueDate: text('dueDate'), // ISO format or natural lang string extracted
  status: text('status').notNull().default('pending'), // 'pending' | 'completed'
  calendarEventId: text('calendarEventId'),
  sourceDiaryId: text('sourceDiaryId').references(() => diaryEntries.id, { onDelete: 'set null' }),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
});

export const structuredMemories = sqliteTable('structured_memories', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  category: text('category').notNull(), // 'study', 'work', 'life', 'general'
  type: text('type').notNull(), // 'fact', 'preference', 'goal', 'ongoing_project'
  content: text('content').notNull(),
  date: text('date').notNull(), // Date the memory was extracted YYYY-MM-DD
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
});
