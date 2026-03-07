/**
 * Google OAuth client helper
 * Reads the user's stored refresh_token from the DB and creates an authenticated OAuth2 client.
 */
import { google } from 'googleapis';
import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function getGoogleOAuthClient(userId: string) {
  // Fetch the stored Google account tokens for this user
  const account = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, 'google')))
    .get();

  if (!account) {
    throw new Error('No linked Google account found for this user.');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  oauth2Client.setCredentials({
    access_token: account.access_token ?? undefined,
    refresh_token: account.refresh_token ?? undefined,
  });

  return oauth2Client;
}
