import { google } from 'googleapis';
import { getGoogleOAuthClient } from './auth';

export interface GmailMessage {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

/**
 * Search Gmail for messages matching a query string.
 * @param userId  The authenticated user's ID
 * @param query   Gmail search query, e.g. "after:2024/03/01 before:2024/03/02"
 * @param maxResults Maximum number of messages to return (default 10)
 */
export async function searchGmailMessages(
  userId: string,
  query: string,
  maxResults = 10,
): Promise<GmailMessage[]> {
  const auth = await getGoogleOAuthClient(userId);
  const gmail = google.gmail({ version: 'v1', auth });

  // Step 1: Get message IDs
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  });

  const messageIds = listRes.data.messages ?? [];
  if (messageIds.length === 0) return [];

  // Step 2: Fetch headers for each message (lightweight)
  const messages = await Promise.all(
    messageIds.map(async (m) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: m.id!,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      });

      const headers = msg.data.payload?.headers ?? [];
      const get = (name: string) =>
        headers.find((h) => h.name === name)?.value ?? '';

      return {
        id: m.id!,
        subject: get('Subject'),
        from: get('From'),
        date: get('Date'),
        snippet: msg.data.snippet ?? '',
      };
    }),
  );

  return messages;
}
