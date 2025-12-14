/**
 * Google Calendar Service
 *
 * Provides calendar event retrieval for the Personal Assistant Agent.
 * All operations are readonly.
 */

import { google } from 'googleapis';
import { getAuthenticatedClient } from './google-client';
import type { GoogleAccount, CalendarEvent } from './types';

// Default number of events to fetch
const DEFAULT_MAX_EVENTS = 10;

// Max events to prevent context overflow
const MAX_EVENTS_LIMIT = 25;

// =============================================================================
// Event Retrieval
// =============================================================================

/**
 * Get upcoming calendar events for a specific account.
 *
 * @param account - Google account to query
 * @param days - Number of days to look ahead (default: 7)
 * @param maxEvents - Maximum events to return (default: 10)
 */
export async function getUpcomingEvents(
  account: GoogleAccount,
  days: number = 7,
  maxEvents: number = DEFAULT_MAX_EVENTS
): Promise<CalendarEvent[]> {
  try {
    const auth = await getAuthenticatedClient(account);
    const calendar = google.calendar({ version: 'v3', auth });

    // Calculate time range
    const now = new Date();
    const timeMax = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    // Fetch events from primary calendar
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: Math.min(maxEvents, MAX_EVENTS_LIMIT),
      singleEvents: true,          // Expand recurring events
      orderBy: 'startTime'
    });

    const events = response.data.items || [];
    return events.map(event => formatCalendarEvent(event));
  } catch (error) {
    console.error(`[Calendar] Error fetching events for ${account.email}:`, error);
    throw error;
  }
}

/**
 * Get today's calendar events.
 */
export async function getTodayEvents(
  account: GoogleAccount,
  maxEvents: number = DEFAULT_MAX_EVENTS
): Promise<CalendarEvent[]> {
  try {
    const auth = await getAuthenticatedClient(account);
    const calendar = google.calendar({ version: 'v3', auth });

    // Today's time range (start of day to end of day)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      maxResults: Math.min(maxEvents, MAX_EVENTS_LIMIT),
      singleEvents: true,
      orderBy: 'startTime'
    });

    const events = response.data.items || [];
    console.log(`[Calendar] Found ${events.length} events today for ${account.email}`);
    return events.map(event => formatCalendarEvent(event));
  } catch (error) {
    console.error(`[Calendar] Error fetching today's events for ${account.email}:`, error);
    throw error;
  }
}

/**
 * Search calendar events by query.
 *
 * @param account - Google account to query
 * @param query - Search query (matches summary, description, location)
 * @param days - Number of days to search (default: 30)
 */
export async function searchEvents(
  account: GoogleAccount,
  query: string,
  days: number = 30,
  maxEvents: number = DEFAULT_MAX_EVENTS
): Promise<CalendarEvent[]> {
  try {
    const auth = await getAuthenticatedClient(account);
    const calendar = google.calendar({ version: 'v3', auth });

    const now = new Date();
    const timeMax = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: Math.min(maxEvents, MAX_EVENTS_LIMIT),
      singleEvents: true,
      orderBy: 'startTime',
      q: query                     // Free-text search
    });

    const events = response.data.items || [];
    console.log(`[Calendar] Search "${query}" found ${events.length} events for ${account.email}`);
    return events.map(event => formatCalendarEvent(event));
  } catch (error) {
    console.error(`[Calendar] Error searching events for ${account.email}:`, error);
    throw error;
  }
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Format Google Calendar event to our simplified format.
 * Keeps only essential info to minimize context size.
 */
function formatCalendarEvent(
  event: {
    id?: string | null;
    summary?: string | null;
    description?: string | null;
    start?: { dateTime?: string | null; date?: string | null } | null;
    end?: { dateTime?: string | null; date?: string | null } | null;
    location?: string | null;
    attendees?: Array<{ email?: string | null }> | null;
  }
): CalendarEvent {
  const isAllDay = !event.start?.dateTime;

  return {
    id: event.id || '',
    summary: event.summary || '(No title)',
    description: truncateDescription(event.description),
    start: event.start?.dateTime || event.start?.date || '',
    end: event.end?.dateTime || event.end?.date || '',
    location: event.location || undefined,
    isAllDay,
    attendees: event.attendees
      ?.slice(0, 5)                 // Limit attendees
      .map(a => a.email || '')
      .filter(Boolean) || undefined
  };
}

/**
 * Truncate description to prevent context overflow.
 */
function truncateDescription(description?: string | null): string | undefined {
  if (!description) return undefined;
  const maxLength = 200;
  if (description.length <= maxLength) return description;
  return description.slice(0, maxLength) + '...';
}
