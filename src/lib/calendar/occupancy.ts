import { differenceInMinutes, parseISO } from "date-fns";

import type { CalendarEvent } from "./types";

export function getDayScore(events: CalendarEvent[]) {
  if (events.length === 0) {
    return 0;
  }

  const scheduledMinutes = events.reduce((total, event) => {
    if (event.isAllDay) {
      return total + 8 * 60;
    }

    return total + Math.max(30, differenceInMinutes(parseISO(event.end), parseISO(event.start)));
  }, 0);

  return Math.min(1, scheduledMinutes / (8 * 60));
}

export function getOccupancyGradient(score: number) {
  const hue = 128 - Math.round(score * 92);
  const startLight = 96 - score * 8;
  const endLight = 90 - score * 10;

  return `linear-gradient(180deg, hsl(${hue} 70% ${startLight}%) 0%, hsl(${Math.max(
    30,
    hue - 8,
  )} 82% ${endLight}%) 100%)`;
}

export function getOccupancyBadge(score: number) {
  if (score < 0.15) {
    return "Wide open";
  }

  if (score < 0.55) {
    return "Some plans";
  }

  if (score < 0.85) {
    return "Busy";
  }

  return "Packed";
}
