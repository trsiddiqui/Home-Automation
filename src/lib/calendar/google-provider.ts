import { addHours } from "date-fns";
import { google } from "googleapis";

import type { GoogleSession } from "@/lib/google-auth/session";

import type {
  CalendarEvent,
  CalendarProvider,
  CalendarRange,
  CalendarSnapshot,
  CalendarSource,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from "./types";
import { sortEvents } from "./time";

export function createGoogleCalendarProvider(
  session: GoogleSession,
): CalendarProvider {
  return {
    async getSnapshot(range: CalendarRange): Promise<CalendarSnapshot> {
      const calendar = createCalendarClient(session);
      const calendars = await listVisibleCalendars(session);
      const configuredReadCalendarIds = process.env.GOOGLE_READ_CALENDAR_IDS
        ?.split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const readCalendars =
        configuredReadCalendarIds && configuredReadCalendarIds.length > 0
          ? calendars.filter((source) => configuredReadCalendarIds.includes(source.id))
          : calendars;

      const eventGroups = await Promise.all(
        readCalendars.map(async (source) => {
          const response = await calendar.events.list({
            calendarId: source.id,
            timeMin: range.start,
            timeMax: range.end,
            orderBy: "startTime",
            singleEvents: true,
            maxResults: 250,
          });

          return (response.data.items ?? []).map((entry) =>
            normalizeGoogleEvent(entry, source, getWriteCalendarId()),
          );
        }),
      );

      return {
        source: "google",
        calendars: readCalendars,
        writeCalendarId: getWriteCalendarId(),
        auth: {
          status: "connected",
          user: session.user,
        },
        events: sortEvents(eventGroups.flat()),
      };
    },

    async createEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
      const calendar = createCalendarClient(session);
      const writeCalendarId = getWriteCalendarId();
      const calendars = await listVisibleCalendars(session);
      const writableCalendar =
        calendars.find((entry) => entry.id === writeCalendarId) ??
        calendars.find((entry) => entry.writable);

      const response = await calendar.events.insert({
        calendarId: writeCalendarId,
        requestBody: {
          summary: input.title,
          description: input.description,
          location: input.location,
          start: {
            dateTime: input.start,
          },
          end: {
            dateTime: input.end ?? addHours(new Date(input.start), 1).toISOString(),
          },
        },
      });

      const item = response.data;
      if (!item.id) {
        throw new Error("Google Calendar did not return the created event.");
      }

      return normalizeGoogleEvent(
        item,
        {
          id: writeCalendarId,
          name: writableCalendar?.name ?? "Your Calendar",
          color: writableCalendar?.color ?? "#b05d27",
          writable: true,
        },
        writeCalendarId,
      );
    },

    async updateEvent(input: UpdateCalendarEventInput): Promise<CalendarEvent> {
      const writeCalendarId = getWriteCalendarId();

      if (input.calendarId !== writeCalendarId) {
        throw new Error("Only your writable calendar events can be edited.");
      }

      const calendar = createCalendarClient(session);
      const calendars = await listVisibleCalendars(session);
      const writableCalendar =
        calendars.find((entry) => entry.id === writeCalendarId) ??
        calendars.find((entry) => entry.writable);

      const response = await calendar.events.patch({
        calendarId: input.calendarId,
        eventId: input.eventId,
        requestBody: {
          summary: input.title,
          description: input.description,
          location: input.location,
          start: input.start ? { dateTime: input.start } : undefined,
          end: input.end ? { dateTime: input.end } : undefined,
        },
      });

      const item = response.data;
      if (!item.id) {
        throw new Error("Google Calendar did not return the updated event.");
      }

      return normalizeGoogleEvent(
        item,
        {
          id: writeCalendarId,
          name: writableCalendar?.name ?? "Your Calendar",
          color: writableCalendar?.color ?? "#b05d27",
          writable: true,
        },
        writeCalendarId,
      );
    },
  };
}

function createCalendarClient(session: GoogleSession) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error(
      "Google Calendar credentials are missing. Add the env vars from .env.example.",
    );
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  auth.setCredentials({
    access_token: session.accessToken,
    expiry_date: session.expiryDate,
    refresh_token: session.refreshToken,
  });

  return google.calendar({ version: "v3", auth });
}

async function listVisibleCalendars(
  session: GoogleSession,
): Promise<CalendarSource[]> {
  const calendar = createCalendarClient(session);
  const items: CalendarSource[] = [];
  let pageToken: string | undefined;

  do {
    const response = await calendar.calendarList.list({
      minAccessRole: "reader",
      pageToken,
      showDeleted: false,
      showHidden: false,
    });

    for (const entry of response.data.items ?? []) {
      if (!entry.id) {
        continue;
      }

      items.push({
        id: entry.id,
        name: entry.summaryOverride ?? entry.summary ?? entry.id,
        color: entry.backgroundColor ?? "#7f7f7f",
        writable:
          entry.accessRole === "owner" ||
          entry.accessRole === "writer" ||
          entry.primary === true,
      });
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return items;
}

function normalizeGoogleEvent(
  entry: {
    id?: string | null;
    summary?: string | null;
    description?: string | null;
    location?: string | null;
    start?: { date?: string | null; dateTime?: string | null } | null;
    end?: { date?: string | null; dateTime?: string | null } | null;
  },
  calendar: CalendarSource,
  writeCalendarId: string,
) {
  const isAllDay = Boolean(entry.start?.date && !entry.start?.dateTime);
  const start = isAllDay
    ? new Date(`${entry.start?.date}T00:00:00`).toISOString()
    : entry.start?.dateTime ?? new Date().toISOString();
  const end = isAllDay
    ? new Date(`${entry.end?.date}T00:00:00`).toISOString()
    : entry.end?.dateTime ?? addHours(new Date(start), 1).toISOString();

  return {
    id: entry.id ?? crypto.randomUUID(),
    title: entry.summary ?? "Untitled event",
    description: entry.description ?? "",
    location: entry.location ?? "",
    start,
    end,
    isAllDay,
    calendarId: calendar.id,
    calendarName: calendar.name,
    calendarColor: calendar.color,
    editable: calendar.writable && calendar.id === writeCalendarId,
  } satisfies CalendarEvent;
}

function getWriteCalendarId() {
  return process.env.GOOGLE_WRITE_CALENDAR_ID?.trim() || "primary";
}
