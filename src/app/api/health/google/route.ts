import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getGoogleOAuthClient } from '@/lib/google/auth';
import { google } from 'googleapis';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const sessionAny = session as any;
    const tokens = {
      accessToken: sessionAny.accessToken as string | undefined,
      refreshToken: sessionAny.refreshToken as string | undefined,
    };

    if (!tokens.accessToken) {
      return NextResponse.json({ ok: false, error: 'google_auth_failed' });
    }

    const oauth = await getGoogleOAuthClient(session.user.id, tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth });
    
    // Lightweight check: Attempt to list calendars to verify token validity
    await calendar.calendarList.list({ maxResults: 1 });
    
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Google Health Check Failed:', err);
    return NextResponse.json({ 
      ok: false, 
      error: 'google_auth_failed', 
      details: err?.message || String(err)
    });
  }
}
