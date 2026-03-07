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

    const oauth = await getGoogleOAuthClient(session.user.id);
    const calendar = google.calendar({ version: 'v3', auth: oauth });
    
    // Lightweight check: Attempt to list calendars to verify token validity
    await calendar.calendarList.list({ maxResults: 1 });
    
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Google Health Check Failed:', err);
    return NextResponse.json({ ok: false, error: 'google_auth_failed' });
  }
}
