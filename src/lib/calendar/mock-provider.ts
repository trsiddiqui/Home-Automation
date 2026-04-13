import { addDays, addHours, startOfDay } from "date-fns";

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

const calendars: CalendarSource[] = [
  {
    id: "primary",
    name: "Your Calendar",
    color: "#b05d27",
    writable: true,
  },
  {
    id: "shared-family",
    name: "Shared Family",
    color: "#4f8f6e",
    writable: false,
  },
  {
    id: "school",
    name: "School Reminders",
    color: "#6578c7",
    writable: false,
  },
];

const today = startOfDay(new Date());

let events: CalendarEvent[] = [
  createDemoEvent({
    id: "demo-1",
    title: "Morning workout",
    start: addHours(today, 7),
    end: addHours(today, 8),
    calendarId: "primary",
    location: "Basement gym",
  }),
  createDemoEvent({
    id: "demo-2",
    title: "Dentist appointment",
    start: addHours(addDays(today, 1), 10),
    end: addHours(addDays(today, 1), 11),
    calendarId: "primary",
    location: "Elm Dental",
  }),
  createDemoEvent({
    id: "demo-3",
    title: "Shared family supper",
    start: addHours(addDays(today, 2), 17),
    end: addHours(addDays(today, 2), 19),
    calendarId: "shared-family",
    location: "Home",
  }),
  createDemoEvent({
    id: "demo-4",
    title: "School concert",
    start: addHours(addDays(today, 3), 18),
    end: addHours(addDays(today, 3), 20),
    calendarId: "school",
    location: "Auditorium",
  }),
  createDemoEvent({
    id: "demo-5",
    title: "Project review",
    start: addHours(addDays(today, 4), 13),
    end: addHours(addDays(today, 4), 15),
    calendarId: "primary",
    location: "Video call",
  }),
];

export const mockCalendarProvider: CalendarProvider = {
  async getSnapshot(range: CalendarRange): Promise<CalendarSnapshot> {
    const from = new Date(range.start);
    const to = new Date(range.end);

    return {
      source: "mock",
      calendars,
      writeCalendarId: "primary",
      auth: {
        status: "signed_out",
        user: null,
      },
      events: sortEvents(
        events.filter((event) => {
          const start = new Date(event.start);
          return start >= from && start <= to;
        }),
      ),
    };
  },

  async createEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    const createdEvent = createDemoEvent({
      id: `demo-${Date.now()}`,
      title: input.title,
      start: new Date(input.start),
      end: input.end ? new Date(input.end) : addHours(new Date(input.start), 1),
      calendarId: "primary",
      location: input.location ?? "",
      description: input.description ?? "",
    });

    events = sortEvents([...events, createdEvent]);

    return createdEvent;
  },

  async updateEvent(input: UpdateCalendarEventInput): Promise<CalendarEvent> {
    const existingEvent = events.find(
      (event) => event.id === input.eventId && event.calendarId === input.calendarId,
    );

    if (!existingEvent) {
      throw new Error("The event could not be found.");
    }

    if (existingEvent.calendarId !== "primary") {
      throw new Error("This demo event is read only.");
    }

    const updatedEvent: CalendarEvent = {
      ...existingEvent,
      title: input.title ?? existingEvent.title,
      description: input.description ?? existingEvent.description,
      location: input.location ?? existingEvent.location,
      start: input.start ?? existingEvent.start,
      end: input.end ?? existingEvent.end,
    };

    events = sortEvents(
      events.map((event) =>
        event.id === updatedEvent.id && event.calendarId === updatedEvent.calendarId
          ? updatedEvent
          : event,
      ),
    );

    return updatedEvent;
  },
};

function createDemoEvent({
  id,
  title,
  start,
  end,
  calendarId,
  location = "",
  description = "",
}: {
  id: string;
  title: string;
  start: Date;
  end: Date;
  calendarId: string;
  location?: string;
  description?: string;
}) {
  const calendar = calendars.find((entry) => entry.id === calendarId);

  return {
    id,
    title,
    description,
    location,
    start: start.toISOString(),
    end: end.toISOString(),
    isAllDay: false,
    calendarId,
    calendarName: calendar?.name ?? "Unknown",
    calendarColor: calendar?.color ?? "#7f7f7f",
    editable: calendarId === "primary",
  } satisfies CalendarEvent;
}
