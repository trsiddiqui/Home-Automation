import type { CSSProperties } from "react";
import {
  addDays,
  addMinutes,
  differenceInMinutes,
  format,
  isSameDay,
  parseISO,
  setHours,
  setMinutes,
  setSeconds,
  startOfDay,
} from "date-fns";

import type { CalendarEvent, CalendarSnapshot } from "@/lib/calendar/types";

export const WEEK_SLOT_HOURS = Array.from({ length: 24 }, (_, hour) => hour);
export const WEEK_SLOT_HEIGHT = 80;
export const DAY_CLOCK_RADIUS = 282;

export function buildStatusMessage(snapshot: CalendarSnapshot) {
  if (snapshot.auth.status === "connected") {
    return `Connected to Google Calendar as ${snapshot.auth.user?.email ?? "your account"}.`;
  }

  if (snapshot.auth.status === "missing_configuration") {
    return "Google OAuth is not configured yet. The app is showing demo data.";
  }

  return "Showing demo data until you sign in with Google.";
}

export function getEventsForDay(events: CalendarEvent[], date: Date) {
  return [...events]
    .filter((event) => isSameDay(parseISO(event.start), date))
    .sort(
      (left, right) =>
        new Date(left.start).getTime() - new Date(right.start).getTime(),
    );
}

export function getEventsForHour(
  events: CalendarEvent[],
  date: Date,
  hour: number,
) {
  const slotStart = moveEventToSlot(date, hour);
  const slotEnd = addMinutes(slotStart, 60);

  return events.filter((event) => {
    const start = parseISO(event.start);
    const end = parseISO(event.end);

    return start < slotEnd && end > slotStart;
  });
}

export function moveEventToDay(event: CalendarEvent, nextDay: Date) {
  const currentStart = parseISO(event.start);

  return setSeconds(
    setMinutes(
      setHours(startOfDay(nextDay), currentStart.getHours()),
      currentStart.getMinutes(),
    ),
    0,
  );
}

export function moveEventToSlot(date: Date, hour: number) {
  return setSeconds(setMinutes(setHours(startOfDay(date), hour), 0), 0);
}

export function buildWeekEventStyle(
  event: CalendarEvent,
  options?: {
    minimumHeight?: number;
    startHour?: number;
  },
) {
  const start = parseISO(event.start);
  const end = parseISO(event.end);

  return buildWeekSpanStyle(start, end, options);
}

export function buildWeekSpanStyle(
  start: Date,
  end: Date,
  options?: {
    minimumHeight?: number;
    startHour?: number;
  },
): CSSProperties {
  const startHour = options?.startHour ?? 0;
  const minimumHeight = options?.minimumHeight ?? 30;
  const startMinutes = start.getHours() * 60 + start.getMinutes() - startHour * 60;
  const duration = Math.max(1, differenceInMinutes(end, start));

  return {
    top: `${Math.max(0, (startMinutes / 60) * WEEK_SLOT_HEIGHT)}px`,
    height: `${Math.max((duration / 60) * WEEK_SLOT_HEIGHT, minimumHeight)}px`,
  };
}

export function buildClockBackground(
  slotSummaries: Array<{ hour: number; events: CalendarEvent[] }>,
) {
  const slices = slotSummaries.map((slot, index) => {
    const sliceStart = index * 15;
    const sliceEnd = (index + 1) * 15;
    const alpha =
      slot.events.length === 0 ? 0.24 : Math.min(0.88, 0.36 + slot.events.length * 0.14);
    const color =
      slot.events.length === 0
        ? `rgba(255,255,255,${alpha})`
        : `rgba(176, 93, 39, ${alpha})`;
    return `${color} ${sliceStart}deg ${sliceEnd}deg`;
  });

  return `conic-gradient(${slices.join(", ")})`;
}

export function formatRange(start: Date | null, end: Date | null) {
  if (!start) {
    return "Select a date range";
  }

  if (!end) {
    return `${format(start, "EEEE, MMMM d h:mm a")} to choose an end`;
  }

  const durationMinutes = Math.max(1, differenceInMinutes(end, start));
  const durationHours = Math.floor(durationMinutes / 60);
  const remainingMinutes = durationMinutes % 60;
  const durationLabel =
    durationHours === 0
      ? `${durationMinutes} min`
      : remainingMinutes === 0
        ? `${durationHours} hour${durationHours === 1 ? "" : "s"}`
        : `${durationHours}h ${remainingMinutes}m`;

  if (isSameDay(start, end)) {
    return `${format(start, "EEE, MMM d")} · ${format(start, "h:mm a")} - ${format(end, "h:mm a")} · ${durationLabel}`;
  }

  return `${format(start, "EEE, MMM d h:mm a")} - ${format(end, "EEE, MMM d h:mm a")} · ${durationLabel}`;
}

export function formatEventTime(start: string, end: string, isAllDay: boolean) {
  if (isAllDay) {
    return "All day";
  }

  return `${format(parseISO(start), "h:mm a")} - ${format(parseISO(end), "h:mm a")}`;
}

export function formatFreeRange(start: Date, end: Date) {
  return `${format(start, "h:mm a")} to ${format(end, "h:mm a")}`;
}

export function formatHourLabel(hour: number) {
  return format(setHours(startOfDay(new Date()), hour), "ha");
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function shouldHideEvent(event: CalendarEvent) {
  return event.title.trim().toLowerCase() === "home";
}

export function getFreeSlotsForDay(
  events: CalendarEvent[],
  day: Date,
  options?: {
    includeEdges?: boolean;
    minimumMinutes?: number;
  },
) {
  const includeEdges = options?.includeEdges ?? true;
  const minimumMinutes = options?.minimumMinutes ?? 5;
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const dayEvents = getEventsForDay(events, day)
    .filter((event) => !event.isAllDay)
    .map((event) => {
      const start = parseISO(event.start);
      const end = parseISO(event.end);

      return {
        start: start < dayStart ? dayStart : start,
        end: end > dayEnd ? dayEnd : end,
      };
    });

  const freeSlots: Array<{ start: Date; end: Date }> = [];

  if (includeEdges) {
    let cursor = dayStart;

    for (const event of dayEvents) {
      if (event.start > cursor) {
        freeSlots.push({
          start: cursor,
          end: event.start,
        });
      }

      if (event.end > cursor) {
        cursor = event.end;
      }
    }

    if (cursor < dayEnd) {
      freeSlots.push({
        start: cursor,
        end: dayEnd,
      });
    }
  } else {
    if (dayEvents.length < 2) {
      return [];
    }

    let cursor = dayEvents[0].end;

    for (const event of dayEvents.slice(1)) {
      if (event.start > cursor) {
        freeSlots.push({
          start: cursor,
          end: event.start,
        });
      }

      if (event.end > cursor) {
        cursor = event.end;
      }
    }
  }

  return freeSlots.filter(
    (slot) => differenceInMinutes(slot.end, slot.start) >= minimumMinutes,
  );
}

export function getWeekVisibleRange(events: CalendarEvent[]) {
  const timedEvents = events.filter((event) => !event.isAllDay);

  if (timedEvents.length === 0) {
    return {
      endHour: 18,
      hours: Array.from({ length: 10 }, (_, index) => index + 8),
      startHour: 8,
    };
  }

  const earliestMinutes = Math.min(
    ...timedEvents.map((event) => {
      const start = parseISO(event.start);
      return start.getHours() * 60 + start.getMinutes();
    }),
  );
  const latestMinutes = Math.max(
    ...timedEvents.map((event) => {
      const start = parseISO(event.start);
      const end = parseISO(event.end);

      if (format(start, "yyyy-MM-dd") !== format(end, "yyyy-MM-dd")) {
        return 24 * 60;
      }

      return end.getHours() * 60 + end.getMinutes();
    }),
  );

  const startHour = Math.max(0, Math.floor(earliestMinutes / 60));
  const endHour = Math.min(
    24,
    Math.max(startHour + 1, Math.ceil(latestMinutes / 60) + 1),
  );

  return {
    endHour,
    hours: Array.from(
      { length: Math.max(1, endHour - startHour) },
      (_, index) => startHour + index,
    ),
    startHour,
  };
}

export function clampSlotToVisibleRange(
  slot: { start: Date; end: Date },
  day: Date,
  startHour: number,
  endHour: number,
) {
  const visibleStart = moveEventToSlot(day, startHour);
  const visibleEnd =
    endHour >= 24 ? addDays(startOfDay(day), 1) : moveEventToSlot(day, endHour);
  const start = slot.start < visibleStart ? visibleStart : slot.start;
  const end = slot.end > visibleEnd ? visibleEnd : slot.end;

  if (end <= start) {
    return null;
  }

  return { end, start };
}
