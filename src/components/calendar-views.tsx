"use client";

import clsx from "clsx";
import { addDays, differenceInMinutes, format, parseISO, startOfDay } from "date-fns";

import styles from "./family-calendar-app.module.css";
import {
  WEEK_SLOT_HEIGHT,
  buildWeekSpanStyle,
  buildWeekEventStyle,
  clampSlotToVisibleRange,
  formatFreeRange,
  formatHourLabel,
  getFreeSlotsForDay,
  getEventsForDay,
  getWeekVisibleRange,
  moveEventToSlot,
} from "./calendar-helpers";
import { EventSurface } from "./calendar-shared";
import type { CalendarEvent } from "@/lib/calendar/types";
import type { DisplayMode } from "@/lib/display-mode";
import { getDayScore, getOccupancyBadge, getOccupancyGradient } from "@/lib/calendar/occupancy";
import { getMonthGrid, getWeekDays } from "@/lib/calendar/time";

function getDayBoundaryLabels(events: CalendarEvent[]) {
  const timedEvents = events.filter((event) => !event.isAllDay);

  if (timedEvents.length === 0) {
    return {
      endingLabel: "Free all day",
      startingLabel: "Starting day open",
    };
  }

  return {
    endingLabel: `Free after ${format(parseISO(timedEvents[timedEvents.length - 1].end), "h:mm a")}`,
    startingLabel: `Starting day at ${format(parseISO(timedEvents[0].start), "h:mm a")}`,
  };
}

function getTrailingAvailabilitySlot(
  events: CalendarEvent[],
  day: Date,
  endHour: number,
) {
  const timedEvents = events.filter((event) => !event.isAllDay);

  if (timedEvents.length === 0) {
    return null;
  }

  const lastEventEnd = parseISO(timedEvents[timedEvents.length - 1].end);
  const visibleEnd =
    endHour >= 24 ? addDays(startOfDay(day), 1) : moveEventToSlot(day, endHour);

  if (visibleEnd <= lastEventEnd) {
    return null;
  }

  return {
    end: visibleEnd,
    label: `Free after ${format(lastEventEnd, "h:mm a")}`,
    start: lastEventEnd,
  };
}

function getLeadingAvailabilitySlot(
  events: CalendarEvent[],
  day: Date,
  startHour: number,
) {
  const timedEvents = events.filter((event) => !event.isAllDay);

  if (timedEvents.length === 0) {
    return null;
  }

  const firstEventStart = parseISO(timedEvents[0].start);
  const visibleStart = moveEventToSlot(day, startHour);

  if (firstEventStart <= visibleStart) {
    return null;
  }

  return {
    end: firstEventStart,
    label: `Free before ${format(firstEventStart, "h:mm a")}`,
    start: visibleStart,
  };
}

function getDayAgendaFreeCardHeight(minutes: number) {
  return Math.max(26, Math.min(128, Math.round(minutes * 0.75)));
}

export function MonthView({
  anchorDate,
  displayMode,
  draggedEvent,
  groupedEvents,
  onDropDay,
  onEventClick,
  onEventDragStart,
  onMoreEvents,
  visibleCount,
}: {
  anchorDate: Date;
  displayMode: DisplayMode;
  draggedEvent: CalendarEvent | null;
  groupedEvents: Record<string, CalendarEvent[]>;
  onDropDay: (day: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onEventDragStart: (event: CalendarEvent | null) => void;
  onMoreEvents: (day: Date) => void;
  visibleCount: number;
}) {
  const monthDays = getMonthGrid(anchorDate);

  return (
    <div
      className={styles.monthGrid}
      style={{
        gridTemplateRows: `repeat(${monthDays.length / 7}, minmax(0, 1fr))`,
      }}
    >
      {monthDays.map((day) => {
        const key = format(day, "yyyy-MM-dd");
        const dayEvents = groupedEvents[key] ?? [];
        const score = getDayScore(dayEvents);
        const longFreeSlots = getFreeSlotsForDay(dayEvents, day, {
          includeEdges: false,
          minimumMinutes: 5,
        }).slice(0, 1);
        const visibleEvents = dayEvents.slice(
          0,
          Math.max(0, visibleCount - longFreeSlots.length),
        );
        const visibleItems = [
          ...visibleEvents.map((event) => ({
            kind: "event" as const,
            key: `${event.calendarId}-${event.id}`,
            start: parseISO(event.start),
            event,
          })),
          ...longFreeSlots.map((slot, index) => ({
            kind: "free" as const,
            key: `free-${key}-${index}`,
            start: slot.start,
            end: slot.end,
          })),
        ].sort((left, right) => left.start.getTime() - right.start.getTime());
        const hiddenEventCount = Math.max(0, dayEvents.length - visibleEvents.length);

        return (
          <article
            key={key}
            className={clsx(
              styles.monthCard,
              draggedEvent?.editable && styles.monthCardDroppable,
            )}
            style={{ background: getOccupancyGradient(score) }}
            onDragOver={(event) => {
              if (!draggedEvent?.editable) {
                return;
              }

              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              onDropDay(day);
            }}
          >
            <div className={styles.monthCardTop}>
              <div>
                <p className={styles.dayLabel}>{format(day, "EEE")}</p>
                <h3 className={styles.dayNumber}>{format(day, "d")}</h3>
              </div>
              <span className={styles.occupancyBadge}>{getOccupancyBadge(score)}</span>
            </div>

            <div className={styles.monthCardMeta}>
              {dayEvents.length === 0
                ? "Clear day"
                : `${dayEvents.length} scheduled ${
                    dayEvents.length === 1 ? "event" : "events"
                  }`}
            </div>

            <div className={styles.monthEventStack}>
              {visibleItems.map((item) =>
                item.kind === "event" ? (
                  <EventSurface
                    key={item.key}
                    event={item.event}
                    onClick={() => onEventClick(item.event)}
                    onDragStart={onEventDragStart}
                    variant={displayMode === "mobile" ? "compact" : "mini"}
                  />
                ) : (
                  <div key={item.key} className={styles.monthFreeChip}>
                    <span className={styles.monthFreeLabel}>Free</span>
                    <strong>{formatFreeRange(item.start, item.end)}</strong>
                  </div>
                ),
              )}

              {hiddenEventCount > 0 ? (
                <button
                  type="button"
                  className={styles.moreEventsButton}
                  onClick={() => onMoreEvents(day)}
                >
                  +{hiddenEventCount} more
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function WeekTimelineView({
  anchorDate,
  draggedEvent,
  events,
  onDropSlot,
  onEventClick,
  onEventDragStart,
}: {
  anchorDate: Date;
  draggedEvent: CalendarEvent | null;
  events: CalendarEvent[];
  onDropSlot: (day: Date, hour: number) => void;
  onEventClick: (event: CalendarEvent) => void;
  onEventDragStart: (event: CalendarEvent | null) => void;
}) {
  const weekDays = getWeekDays(anchorDate);
  const groupedByDay = weekDays.map((day) => getEventsForDay(events, day));
  const dayBoundaryLabels = groupedByDay.map((dayEvents) =>
    getDayBoundaryLabels(dayEvents),
  );
  const baseVisibleRange = getWeekVisibleRange(events);
  const visibleRange = {
    ...baseVisibleRange,
    hours: Array.from(
      {
        length: Math.max(
          1,
          baseVisibleRange.endHour - Math.max(0, baseVisibleRange.startHour - 1),
        ),
      },
      (_, index) => Math.max(0, baseVisibleRange.startHour - 1) + index,
    ),
    startHour: Math.max(0, baseVisibleRange.startHour - 1),
  };
  const leadingSlotsByDay = weekDays.map((day, dayIndex) =>
    getLeadingAvailabilitySlot(
      groupedByDay[dayIndex],
      day,
      visibleRange.startHour,
    ),
  );
  const trailingSlotsByDay = weekDays.map((day, dayIndex) =>
    getTrailingAvailabilitySlot(
      groupedByDay[dayIndex],
      day,
      visibleRange.endHour,
    ),
  );
  const weekHeight = visibleRange.hours.length * WEEK_SLOT_HEIGHT;
  const weekGridStyle = {
    gridTemplateRows: `repeat(${visibleRange.hours.length}, ${WEEK_SLOT_HEIGHT}px)`,
  };
  const freeSlotsByDay = weekDays.map((day) =>
    getFreeSlotsForDay(events, day, {
      includeEdges: false,
      minimumMinutes: 5,
    })
      .map((slot) =>
        clampSlotToVisibleRange(
          slot,
          day,
          visibleRange.startHour,
          visibleRange.endHour,
        ),
      )
      .filter((slot): slot is { start: Date; end: Date } => slot !== null),
  );

  return (
    <div className={styles.weekTimelineShell}>
      <div className={styles.weekHeaderSticky}>
        <div className={styles.weekTimeGutter} />
        {weekDays.map((day, dayIndex) => (
          <div key={format(day, "yyyy-MM-dd")} className={styles.weekHeaderCell}>
            <div>
              <span>{format(day, "EEE")}</span>
              <strong>{format(day, "d")}</strong>
            </div>
            <div className={styles.weekBoundaryCard}>
              {dayBoundaryLabels[dayIndex].startingLabel}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.weekTimelineBody}>
        <div className={styles.weekTimeColumn}>
          {visibleRange.hours.map((hour) => (
            <div key={hour} className={styles.weekTimeCell} style={{ height: WEEK_SLOT_HEIGHT }}>
              {formatHourLabel(hour)}
            </div>
          ))}
        </div>

        {weekDays.map((day, dayIndex) => (
          <div
            key={format(day, "yyyy-MM-dd")}
            className={styles.weekDayColumn}
            style={{ height: weekHeight }}
          >
            <div className={styles.weekSlotGrid} style={weekGridStyle}>
              {visibleRange.hours.map((hour) => (
                <button
                  key={`${format(day, "yyyy-MM-dd")}-${hour}`}
                  type="button"
                  className={styles.weekSlotCell}
                  style={{ height: WEEK_SLOT_HEIGHT }}
                  onDragOver={(event) => {
                    if (!draggedEvent?.editable) {
                      return;
                    }

                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    onDropSlot(day, hour);
                  }}
                  aria-label={`${format(day, "EEEE")} ${formatHourLabel(hour)}`}
                />
              ))}
            </div>

            <div className={styles.weekEventLayer} style={{ height: weekHeight }}>
              {leadingSlotsByDay[dayIndex] ? (
                <div
                  className={clsx(
                    styles.freeSlotBand,
                    differenceInMinutes(
                      leadingSlotsByDay[dayIndex].end,
                      leadingSlotsByDay[dayIndex].start,
                    ) < 20 && styles.freeSlotBandCompact,
                  )}
                  style={buildWeekSpanStyle(
                    leadingSlotsByDay[dayIndex].start,
                    leadingSlotsByDay[dayIndex].end,
                    {
                      minimumHeight:
                        differenceInMinutes(
                          leadingSlotsByDay[dayIndex].end,
                          leadingSlotsByDay[dayIndex].start,
                        ) < 20
                          ? 18
                          : 0,
                      startHour: visibleRange.startHour,
                    },
                  )}
                >
                  <span
                    className={clsx(
                      styles.freeSlotLabel,
                      differenceInMinutes(
                        leadingSlotsByDay[dayIndex].end,
                        leadingSlotsByDay[dayIndex].start,
                      ) < 20 && styles.freeSlotLabelCompact,
                    )}
                  >
                    {leadingSlotsByDay[dayIndex].label}
                  </span>
                </div>
              ) : null}

              {freeSlotsByDay[dayIndex].map((slot) => (
                <div
                  key={`free-${format(day, "yyyy-MM-dd")}-${slot.start.toISOString()}`}
                  className={clsx(
                    styles.freeSlotBand,
                    differenceInMinutes(slot.end, slot.start) < 20 &&
                      styles.freeSlotBandCompact,
                  )}
                  style={buildWeekSpanStyle(slot.start, slot.end, {
                    minimumHeight:
                      differenceInMinutes(slot.end, slot.start) < 20 ? 18 : 0,
                    startHour: visibleRange.startHour,
                  })}
                >
                  <span
                    className={clsx(
                      styles.freeSlotLabel,
                      differenceInMinutes(slot.end, slot.start) < 20 &&
                        styles.freeSlotLabelCompact,
                    )}
                  >
                    Free {formatFreeRange(slot.start, slot.end)}
                  </span>
                </div>
              ))}

              {groupedByDay[dayIndex].map((event) => (
                <EventSurface
                  key={`${event.calendarId}-${event.id}`}
                  event={event}
                  onClick={() => onEventClick(event)}
                  onDragStart={onEventDragStart}
                  style={buildWeekEventStyle(event, {
                    minimumHeight: 34,
                    startHour: visibleRange.startHour,
                  })}
                  variant="timeline"
                />
              ))}

              {trailingSlotsByDay[dayIndex] ? (
                <div
                  className={clsx(
                    styles.freeSlotBand,
                    differenceInMinutes(
                      trailingSlotsByDay[dayIndex].end,
                      trailingSlotsByDay[dayIndex].start,
                    ) < 20 && styles.freeSlotBandCompact,
                  )}
                  style={buildWeekSpanStyle(
                    trailingSlotsByDay[dayIndex].start,
                    trailingSlotsByDay[dayIndex].end,
                    {
                      minimumHeight:
                        differenceInMinutes(
                          trailingSlotsByDay[dayIndex].end,
                          trailingSlotsByDay[dayIndex].start,
                        ) < 20
                          ? 18
                          : 0,
                      startHour: visibleRange.startHour,
                    },
                  )}
                >
                  <span
                    className={clsx(
                      styles.freeSlotLabel,
                      differenceInMinutes(
                        trailingSlotsByDay[dayIndex].end,
                        trailingSlotsByDay[dayIndex].start,
                      ) < 20 && styles.freeSlotLabelCompact,
                    )}
                  >
                    {trailingSlotsByDay[dayIndex].label}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DayClockView({
  date,
  events,
  onDropHour,
  onEventClick,
  onEventDragStart,
}: {
  date: Date;
  events: CalendarEvent[];
  onDropHour: (hour: number) => void;
  onEventClick: (event: CalendarEvent) => void;
  onEventDragStart: (event: CalendarEvent | null) => void;
}) {
  const allDayEvents = events.filter((event) => event.isAllDay);
  const timedEvents = events.filter((event) => !event.isAllDay);
  const baseVisibleRange = getWeekVisibleRange(timedEvents);
  const visibleRange = {
    ...baseVisibleRange,
    hours: Array.from(
      {
        length: Math.max(
          1,
          baseVisibleRange.endHour - Math.max(0, baseVisibleRange.startHour - 1),
        ),
      },
      (_, index) => Math.max(0, baseVisibleRange.startHour - 1) + index,
    ),
    startHour: Math.max(0, baseVisibleRange.startHour - 1),
  };
  const leadingFreeSlot = getLeadingAvailabilitySlot(
    timedEvents,
    date,
    visibleRange.startHour,
  );
  const trailingFreeSlot = getTrailingAvailabilitySlot(
    timedEvents,
    date,
    visibleRange.endHour,
  );
  const dayHeight = visibleRange.hours.length * WEEK_SLOT_HEIGHT;
  const dayGridStyle = {
    gridTemplateRows: `repeat(${visibleRange.hours.length}, ${WEEK_SLOT_HEIGHT}px)`,
  };
  const freeSlots = getFreeSlotsForDay(events, date, {
    includeEdges: false,
    minimumMinutes: 5,
  })
    .map((slot) =>
      clampSlotToVisibleRange(
        slot,
        date,
        visibleRange.startHour,
        visibleRange.endHour,
      ),
    )
    .filter((slot): slot is { start: Date; end: Date } => slot !== null);
  const agendaItems = [
    ...timedEvents.map((event) => ({
      kind: "event" as const,
      key: `${event.calendarId}-${event.id}`,
      start: parseISO(event.start),
      end: parseISO(event.end),
      event,
    })),
    ...freeSlots.map((slot, index) => ({
      kind: "free" as const,
      key: `free-${index}-${slot.start.toISOString()}`,
      label: `Free ${formatFreeRange(slot.start, slot.end)}`,
      start: slot.start,
      end: slot.end,
    })),
    ...(leadingFreeSlot
      ? [
          {
            kind: "free" as const,
            key: `free-starting-${leadingFreeSlot.start.toISOString()}`,
            label: leadingFreeSlot.label,
            start: leadingFreeSlot.start,
            end: leadingFreeSlot.end,
          },
        ]
      : []),
    ...(trailingFreeSlot
      ? [
          {
            kind: "free" as const,
            key: `free-ending-${trailingFreeSlot.start.toISOString()}`,
            label: trailingFreeSlot.label,
            start: trailingFreeSlot.start,
            end: trailingFreeSlot.end,
          },
        ]
      : []),
  ].sort((left, right) => left.start.getTime() - right.start.getTime());
  const longestFreeSlot = freeSlots.reduce<{ start: Date; end: Date } | null>(
    (current, slot) => {
      if (!current) {
        return slot;
      }

      return differenceInMinutes(slot.end, slot.start) >
        differenceInMinutes(current.end, current.start)
        ? slot
        : current;
    },
    null,
  );
  const busyMinutes = timedEvents.reduce((total, event) => {
    const start = parseISO(event.start);
    const end = parseISO(event.end);

    return total + Math.max(30, differenceInMinutes(end, start));
  }, 0);

  return (
    <div className={styles.dayFlowLayout}>
      <section className={styles.dayFlowPanel}>
        <div className={styles.dayFlowHeader}>
          <div>
            <p className={styles.toolbarLabel}>Day flow</p>
            <h2 className={styles.dayFlowTitle}>{format(date, "EEEE, MMMM d")}</h2>
            <p className={styles.dayFlowHint}>
              Only the active part of the day stays on screen. Free gaps fill their full span in green.
            </p>
          </div>

          <div className={styles.dayFlowMetrics}>
            <div className={styles.dayFlowMetric}>
              <span>Meetings</span>
              <strong>{timedEvents.length}</strong>
            </div>
            <div className={styles.dayFlowMetric}>
              <span>Busy time</span>
              <strong>{Math.round(busyMinutes / 60)}h</strong>
            </div>
            <div className={styles.dayFlowMetricFree}>
              <span>Longest break</span>
              <strong>
                {longestFreeSlot
                  ? formatFreeRange(longestFreeSlot.start, longestFreeSlot.end)
                  : "None"}
              </strong>
            </div>
          </div>
        </div>

        {allDayEvents.length > 0 ? (
          <div className={styles.dayAllDayRow}>
            {allDayEvents.map((event) => (
              <EventSurface
                key={`${event.calendarId}-${event.id}`}
                event={event}
                onClick={() => onEventClick(event)}
                onDragStart={onEventDragStart}
                variant="mini"
              />
            ))}
          </div>
        ) : null}

        <div className={styles.dayTimelineShell}>
          <div className={styles.dayTimelineAxis}>
            {visibleRange.hours.map((hour) => (
              <div
                key={hour}
                className={styles.dayTimelineAxisLabel}
                style={{ height: WEEK_SLOT_HEIGHT }}
              >
                {formatHourLabel(hour)}
              </div>
            ))}
          </div>

          <div className={styles.dayTimelineStage} style={{ minHeight: dayHeight }}>
            <div className={styles.dayTimelineGrid} style={dayGridStyle}>
              {visibleRange.hours.map((hour) => (
                <button
                  key={`day-${format(date, "yyyy-MM-dd")}-${hour}`}
                  type="button"
                  className={styles.dayTimelineCell}
                  style={{ height: WEEK_SLOT_HEIGHT }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    onDropHour(hour);
                  }}
                  aria-label={`${format(date, "EEEE")} ${formatHourLabel(hour)}`}
                />
              ))}
            </div>

            <div className={styles.dayTimelineLayer}>
              {leadingFreeSlot ? (
                <div
                  className={clsx(
                    styles.dayFreeLine,
                    differenceInMinutes(
                      leadingFreeSlot.end,
                      leadingFreeSlot.start,
                    ) < 20 && styles.dayFreeLineCompact,
                  )}
                  style={buildWeekSpanStyle(
                    leadingFreeSlot.start,
                    leadingFreeSlot.end,
                    {
                      minimumHeight:
                        differenceInMinutes(
                          leadingFreeSlot.end,
                          leadingFreeSlot.start,
                        ) < 20
                          ? 18
                          : 0,
                      startHour: visibleRange.startHour,
                    },
                  )}
                >
                  <span
                    className={clsx(
                      styles.dayFreeLineLabel,
                      differenceInMinutes(
                        leadingFreeSlot.end,
                        leadingFreeSlot.start,
                      ) < 20 && styles.dayFreeLineLabelCompact,
                    )}
                  >
                    {leadingFreeSlot.label}
                  </span>
                </div>
              ) : null}

              {freeSlots.map((slot, index) => (
                <div
                  key={`timeline-free-${index}-${slot.start.toISOString()}`}
                  className={clsx(
                    styles.dayFreeLine,
                    differenceInMinutes(slot.end, slot.start) < 20 &&
                      styles.dayFreeLineCompact,
                  )}
                  style={buildWeekSpanStyle(slot.start, slot.end, {
                    minimumHeight:
                      differenceInMinutes(slot.end, slot.start) < 20 ? 18 : 0,
                    startHour: visibleRange.startHour,
                  })}
                >
                  <span
                    className={clsx(
                      styles.dayFreeLineLabel,
                      differenceInMinutes(slot.end, slot.start) < 20 &&
                        styles.dayFreeLineLabelCompact,
                    )}
                  >
                    Free {formatFreeRange(slot.start, slot.end)}
                  </span>
                </div>
              ))}

              {trailingFreeSlot ? (
                <div
                  className={clsx(
                    styles.dayFreeLine,
                    differenceInMinutes(
                      trailingFreeSlot.end,
                      trailingFreeSlot.start,
                    ) < 20 && styles.dayFreeLineCompact,
                  )}
                  style={buildWeekSpanStyle(
                    trailingFreeSlot.start,
                    trailingFreeSlot.end,
                    {
                      minimumHeight:
                        differenceInMinutes(
                          trailingFreeSlot.end,
                          trailingFreeSlot.start,
                        ) < 20
                          ? 18
                          : 0,
                      startHour: visibleRange.startHour,
                    },
                  )}
                >
                  <span
                    className={clsx(
                      styles.dayFreeLineLabel,
                      differenceInMinutes(
                        trailingFreeSlot.end,
                        trailingFreeSlot.start,
                      ) < 20 && styles.dayFreeLineLabelCompact,
                    )}
                  >
                    {trailingFreeSlot.label}
                  </span>
                </div>
              ) : null}

              {timedEvents.map((event) => (
                <EventSurface
                  key={`${event.calendarId}-${event.id}`}
                  event={event}
                  onClick={() => onEventClick(event)}
                  onDragStart={onEventDragStart}
                  style={buildWeekEventStyle(event, {
                    minimumHeight: 34,
                    startHour: visibleRange.startHour,
                  })}
                  variant="timeline"
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className={styles.dayListColumn}>
        <div className={styles.dayListHeading}>
          <p className={styles.toolbarLabel}>Day flow</p>
          <h2>{agendaItems.length === 0 ? "Open day" : `${agendaItems.length} blocks`}</h2>
        </div>
        <div className={styles.dayListStack}>
          {allDayEvents.length > 0 ? (
            <div className={styles.dayAgendaGroup}>
              <p className={styles.toolbarLabel}>All day</p>
              <div className={styles.dayAgendaGroupStack}>
                {allDayEvents.map((event) => (
                  <EventSurface
                    key={`${event.calendarId}-${event.id}`}
                    event={event}
                    onClick={() => onEventClick(event)}
                    onDragStart={onEventDragStart}
                    variant="compact"
                  />
                ))}
              </div>
            </div>
          ) : null}

          {agendaItems.length === 0 ? (
            <div className={styles.emptyDayCard}>
              <h4>Open day</h4>
              <p>Use the add button to schedule something here.</p>
            </div>
          ) : (
            agendaItems.map((item) =>
              item.kind === "event" ? (
                <EventSurface
                  key={item.key}
                  event={item.event}
                  onClick={() => onEventClick(item.event)}
                  onDragStart={onEventDragStart}
                  variant="compact"
                />
              ) : (
                <div
                  key={item.key}
                  className={clsx(
                    styles.dayAgendaFreeCard,
                    differenceInMinutes(item.end, item.start) < 40 &&
                      styles.dayAgendaFreeCardCompact,
                  )}
                  style={{
                    minHeight: getDayAgendaFreeCardHeight(
                      differenceInMinutes(item.end, item.start),
                    ),
                  }}
                >
                  {differenceInMinutes(item.end, item.start) < 40 ? null : (
                    <span className={styles.dayFreeBadge}>Free</span>
                  )}
                  <strong className={styles.dayFreeTitle}>{item.label}</strong>
                  <span className={styles.dayFreeMeta}>
                    {differenceInMinutes(item.end, item.start)} min open
                  </span>
                </div>
              ),
            )
          )}
        </div>
      </div>
    </div>
  );
}
