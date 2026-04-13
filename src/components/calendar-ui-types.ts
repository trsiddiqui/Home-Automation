import type { CalendarEvent } from "@/lib/calendar/types";

export type ApiErrorPayload = {
  error?: string;
};

export type EventEditorMode = "create" | "view" | "edit";

export type EventEditorState = {
  mode: EventEditorMode;
  eventId?: string;
  calendarId: string;
  editable: boolean;
  title: string;
  location: string;
  description: string;
  range: [Date | null, Date | null];
};

export type MoreEventsState = {
  date: Date;
  events: CalendarEvent[];
};
