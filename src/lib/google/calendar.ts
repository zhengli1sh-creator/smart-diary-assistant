import { google } from 'googleapis';
import { getGoogleOAuthClient } from './auth';

export interface CalendarEvent {
  id?: string | null;
  title: string;
  start: string; // ISO datetime
  end: string;   // ISO datetime
  description?: string | null;
}

/**
 * Get calendar events for a date range.
 * @param userId  The authenticated user's ID (from NextAuth session)
 * @param timeMin ISO date string for range start
 * @param timeMax ISO date string for range end
 */
export async function getCalendarEvents(
  userId: string,
  timeMin: string,
  timeMax: string,
  tokens?: { accessToken?: string; refreshToken?: string },
): Promise<CalendarEvent[]> {
  const auth = await getGoogleOAuthClient(userId, tokens);
  const calendar = google.calendar({ version: 'v3', auth });

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 20,
  });

  return (res.data.items ?? []).map((item) => ({
    id: item.id,
    title: item.summary ?? '(无标题)',
    start: item.start?.dateTime ?? item.start?.date ?? '',
    end: item.end?.dateTime ?? item.end?.date ?? '',
    description: item.description,
  }));
}

/**
 * Create a new calendar event.
 */
export async function createCalendarEvent(
  userId: string,
  event: {
    title: string;
    start: string;
    end: string;
    description?: string;
  },
  tokens?: { accessToken?: string; refreshToken?: string },
): Promise<CalendarEvent> {
  const auth = await getGoogleOAuthClient(userId, tokens);
  const calendar = google.calendar({ version: 'v3', auth });

  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: event.title,
      description: event.description,
      start: { dateTime: event.start, timeZone: 'Asia/Shanghai' },
      end: { dateTime: event.end, timeZone: 'Asia/Shanghai' },
    },
  });

  return {
    id: res.data.id,
    title: res.data.summary ?? '',
    start: res.data.start?.dateTime ?? '',
    end: res.data.end?.dateTime ?? '',
    description: res.data.description,
  };
}
