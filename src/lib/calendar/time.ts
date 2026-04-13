import {
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import type { CalendarEvent, CalendarView } from "./types";

export function getRangeForView(anchorDate: Date, view: CalendarView) {
  if (view === "day") {
    return {
      start: startOfDay(anchorDate),
      end: endOfDay(anchorDate),
    };
  }

  if (view === "week") {
    return {
      start: startOfWeek(anchorDate, { weekStartsOn: 0 }),
      end: endOfWeek(anchorDate, { weekStartsOn: 0 }),
    };
  }

  return {
    start: startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(anchorDate), { weekStartsOn: 0 }),
  };
}

export function getMonthGrid(anchorDate: Date) {
  const range = getRangeForView(anchorDate, "month");
  return eachDayOfInterval(range);
}

export function getWeekDays(anchorDate: Date) {
  const range = getRangeForView(anchorDate, "week");
  return eachDayOfInterval(range);
}

export function groupEventsByDay(events: CalendarEvent[]) {
  return events.reduce<Record<string, CalendarEvent[]>>((groups, event) => {
    const key = format(parseISO(event.start), "yyyy-MM-dd");
    const bucket = groups[key];

    if (bucket) {
      bucket.push(event);
    } else {
      groups[key] = [event];
    }

    return groups;
  }, {});
}

export function sortEvents(events: CalendarEvent[]) {
  return [...events].sort(
    (left, right) =>
      new Date(left.start).getTime() - new Date(right.start).getTime(),
  );
}

export function getRelativeLabel(anchorDate: Date, view: CalendarView) {
  if (view === "day") {
    return format(anchorDate, "EEEE, MMMM d");
  }

  if (view === "week") {
    const weekDays = getWeekDays(anchorDate);
    return `${format(weekDays[0], "MMM d")} to ${format(
      weekDays[weekDays.length - 1],
      "MMM d",
    )}`;
  }

  return format(anchorDate, "MMMM yyyy");
}
