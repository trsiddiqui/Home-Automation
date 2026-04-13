export type CalendarView = "day" | "week" | "month";

export type CalendarAuthStatus =
  | "connected"
  | "signed_out"
  | "missing_configuration";

export type CalendarUser = {
  sub: string;
  email: string;
  name: string;
  picture: string;
};

export type CalendarSource = {
  id: string;
  name: string;
  color: string;
  writable: boolean;
};

export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  start: string;
  end: string;
  isAllDay: boolean;
  calendarId: string;
  calendarName: string;
  calendarColor: string;
  editable: boolean;
};

export type CalendarSnapshot = {
  source: "google" | "mock";
  calendars: CalendarSource[];
  events: CalendarEvent[];
  writeCalendarId: string;
  auth: {
    status: CalendarAuthStatus;
    user: CalendarUser | null;
  };
};

export type CreateCalendarEventInput = {
  title: string;
  description?: string;
  location?: string;
  start: string;
  end?: string;
};

export type UpdateCalendarEventInput = {
  eventId: string;
  calendarId: string;
  title?: string;
  description?: string;
  location?: string;
  start?: string;
  end?: string;
};

export type CalendarRange = {
  start: string;
  end: string;
};

export interface CalendarProvider {
  getSnapshot(range: CalendarRange): Promise<CalendarSnapshot>;
  createEvent(input: CreateCalendarEventInput): Promise<CalendarEvent>;
  updateEvent(input: UpdateCalendarEventInput): Promise<CalendarEvent>;
}
