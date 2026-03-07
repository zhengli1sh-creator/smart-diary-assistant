/**
 * Google OAuth client helper
 * Creates an authenticated OAuth2 client using tokens stored in the JWT session.
 */
import { google } from 'googleapis';

export async function getGoogleOAuthClient(
  _userId: string,
  tokens?: { accessToken?: string; refreshToken?: string },
) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  oauth2Client.setCredentials({
    access_token: tokens?.accessToken ?? undefined,
    refresh_token: tokens?.refreshToken ?? undefined,
  });

  return oauth2Client;
}

