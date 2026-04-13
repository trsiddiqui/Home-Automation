"use client";

import clsx from "clsx";
import {
  addDays,
  addHours,
  addMonths,
  format,
  parseISO,
  startOfDay,
} from "date-fns";
import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import { startTransition, useEffect, useState } from "react";

import styles from "./family-calendar-app.module.css";
import {
  AccountPanel,
  EventEditorPanel,
} from "./calendar-panels";
import {
  capitalize,
  getEventsForDay,
  moveEventToDay,
  moveEventToSlot,
  shouldHideEvent,
} from "./calendar-helpers";
import {
  AccountFab,
  ComposeFab,
  DialogShell,
  FloatingNowChip,
  HeaderToggle,
  LinkifiedText,
  ThemeCycleButton,
} from "./calendar-shared";
import {
  KeepDashboard,
  KeepNotePanel,
  KeepSelectionPanel,
} from "./keep-panels";
import type {
  DashboardPage,
  KeepEditorState,
} from "./keep-ui-types";
import { WeatherPanel } from "./weather-panel";
import type {
  ApiErrorPayload,
  EventEditorState,
  MoreEventsState,
} from "./calendar-ui-types";
import {
  DayClockView,
  MonthView,
  WeekTimelineView,
} from "./calendar-views";
import {
  type CalendarAuthStatus,
  type CalendarEvent,
  type CalendarSnapshot,
  type CalendarView,
  type CreateCalendarEventInput,
} from "@/lib/calendar/types";
import {
  getRangeForView,
  getRelativeLabel,
  groupEventsByDay,
} from "@/lib/calendar/time";
import { useDisplayMode } from "@/lib/display-mode";
import {
  DEFAULT_THEME_ID,
  getNextThemeId,
  getThemeById,
} from "@/lib/themes";
import {
  createEmptyListDraft,
  createListDraftFromNote,
  isListDraftEmpty,
  trimListDraft,
} from "@/lib/lists/helpers";
import type { ListNote, ListSnapshot } from "@/lib/lists/types";
import type { WeatherSnapshot } from "@/lib/weather/types";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied:
    "Google sign-in was canceled before calendar access was granted.",
  csrf_mismatch: "Google sign-in could not be verified. Please try again.",
  google_login_failed:
    "Google sign-in failed before the calendar authorization step.",
  missing_credential:
    "Google sign-in did not return the Google credential payload.",
  missing_google_config:
    "Google OAuth is not configured yet. Add the client ID and secret in .env.local.",
  oauth_state_mismatch:
    "Google sign-in could not be completed because the session state expired.",
  token_exchange_failed:
    "Google returned to the app, but the calendar session could not be created.",
};

const VIEW_HINTS: Record<CalendarView, string> = {
  day: "Clock view",
  week: "Timeline week",
  month: "Month board",
};

const HIDDEN_CALENDARS_STORAGE_KEY = "family-calendar-hidden-calendar-ids";
const THEME_STORAGE_KEY = "family-calendar-theme-id";
const WEATHER_COORDS_STORAGE_KEY = "family-calendar-weather-coords";
const WEATHER_SNAPSHOT_TTL_MS = 15 * 60 * 1000;
const EMPTY_CALENDARS: CalendarSnapshot["calendars"] = [];
const EMPTY_LIST_NOTES: ListSnapshot["notes"] = [];

type SavedWeatherCoords = {
  latitude: number;
  longitude: number;
};

function getBoardPrevLabel(anchorDate: Date, view: CalendarView) {
  if (view === "month") {
    return format(addMonths(anchorDate, -1), "MMMM");
  }

  if (view === "day") {
    return format(addDays(anchorDate, -1), "EEEE");
  }

  return "Prev";
}

function getBoardNextLabel(anchorDate: Date, view: CalendarView) {
  if (view === "month") {
    return format(addMonths(anchorDate, 1), "MMMM");
  }

  if (view === "day") {
    return format(addDays(anchorDate, 1), "EEEE");
  }

  return "Next";
}

function getFallbackAuthStatus(googleClientId: string): CalendarAuthStatus {
  return googleClientId ? "signed_out" : "missing_configuration";
}

function sortNotesByUpdatedAt(notes: ListNote[]) {
  return [...notes].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }

    return new Date(right.updateTime).getTime() - new Date(left.updateTime).getTime();
  });
}

function getDefaultRange(seedDate: Date): [Date, Date] {
  const start = addHours(startOfDay(seedDate), 9);
  return [start, addHours(start, 1)];
}

function createEditorState(
  seedDate: Date,
  writeCalendarId: string,
): EventEditorState {
  return {
    mode: "create",
    calendarId: writeCalendarId,
    editable: true,
    title: "",
    location: "",
    description: "",
    range: getDefaultRange(seedDate),
  };
}

function createEditorStateFromEvent(event: CalendarEvent): EventEditorState {
  return {
    mode: "view",
    eventId: event.id,
    calendarId: event.calendarId,
    editable: event.editable,
    title: event.title,
    location: event.location,
    description: event.description,
    range: [parseISO(event.start), parseISO(event.end)],
  };
}

export function FamilyCalendarApp({
  googleClientId,
}: {
  googleClientId: string;
}) {
  const displayMode = useDisplayMode();
  const [page, setPage] = useState<DashboardPage>("calendar");
  const [view, setView] = useState<CalendarView>("month");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [snapshot, setSnapshot] = useState<CalendarSnapshot | null>(null);
  const [keepSnapshot, setKeepSnapshot] = useState<ListSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [keepErrorMessage, setKeepErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [keepLoading, setKeepLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [keepIsSaving, setKeepIsSaving] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [keepRefreshNonce, setKeepRefreshNonce] = useState(0);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);
  const [editorState, setEditorState] = useState<EventEditorState | null>(null);
  const [keepEditorState, setKeepEditorState] = useState<KeepEditorState | null>(null);
  const [keepSelectorOpen, setKeepSelectorOpen] = useState(false);
  const [moreEventsState, setMoreEventsState] = useState<MoreEventsState | null>(
    null,
  );
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [hiddenCalendarIds, setHiddenCalendarIds] = useState<string[]>([]);
  const [calendarPrefsLoaded, setCalendarPrefsLoaded] = useState(false);
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);
  const [weatherCoords, setWeatherCoords] = useState<SavedWeatherCoords | null>(
    null,
  );
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [weatherSnapshot, setWeatherSnapshot] = useState<WeatherSnapshot | null>(
    null,
  );
  const [weatherStatus, setWeatherStatus] = useState<
    "idle" | "locating" | "loading" | "ready" | "error"
  >("idle");
  const [weatherErrorMessage, setWeatherErrorMessage] = useState("");

  const authStatus =
    snapshot?.auth.status ?? getFallbackAuthStatus(googleClientId);
  const activeUser = snapshot?.auth.user ?? null;
  const activeTheme = getThemeById(themeId);
  const calendars = snapshot?.calendars ?? EMPTY_CALENDARS;
  const keepNotes = keepSnapshot?.notes ?? EMPTY_LIST_NOTES;
  const hiddenCalendarIdSet = new Set(hiddenCalendarIds);
  const events = (snapshot?.events ?? []).filter(
    (event) =>
      !shouldHideEvent(event) && !hiddenCalendarIdSet.has(event.calendarId),
  );
  const selectedKeepNotes = keepNotes.filter((note) => note.selected);
  const pinnedKeepNotes = sortNotesByUpdatedAt(
    selectedKeepNotes.filter((note) => note.pinned),
  );
  const regularKeepNotes = sortNotesByUpdatedAt(
    selectedKeepNotes.filter((note) => !note.pinned),
  );
  const groupedEvents = groupEventsByDay(events);
  const currentDayEvents = getEventsForDay(events, anchorDate);
  const visibleMonthEventCount =
    displayMode === "mobile" ? 2 : displayMode === "kiosk" ? 5 : 3;
  const canPersistChanges = authStatus === "connected";
  const writeCalendarId = snapshot?.writeCalendarId ?? "primary";
  const boardTitle = page === "calendar" ? getRelativeLabel(anchorDate, view) : "Lists";
  const prevLabel = getBoardPrevLabel(anchorDate, view);
  const nextLabel = getBoardNextLabel(anchorDate, view);
  const headerTitle =
    page === "calendar" ? getRelativeLabel(anchorDate, view) : "Shared lists";
  const headerHint =
    page === "calendar" ? VIEW_HINTS[view] : "Pinned and selected lists";
  const canSaveEditor = Boolean(
    editorState &&
      canPersistChanges &&
      editorState.mode !== "view" &&
      editorState.title.trim() &&
      editorState.range[0] &&
      editorState.range[1],
  );

  useEffect(() => {
    async function loadSnapshot() {
      const nextRange = getRangeForView(anchorDate, view);
      setIsLoading(true);
      setErrorMessage("");

      try {
        const search = new URLSearchParams({
          from: nextRange.start.toISOString(),
          to: nextRange.end.toISOString(),
        });
        const response = await fetch(`/api/calendar/events?${search.toString()}`);
        const payload = (await response.json()) as CalendarSnapshot | ApiErrorPayload;

        if (!response.ok) {
          throw new Error(
            "error" in payload
              ? payload.error ?? "Unable to load calendar events."
              : "Unable to load calendar events.",
          );
        }

        if (!("auth" in payload)) {
          throw new Error("Calendar data came back in an unexpected format.");
        }

        setSnapshot(payload);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load calendar events.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadSnapshot();
  }, [anchorDate, refreshNonce, view]);

  useEffect(() => {
    if (page !== "lists") {
      return;
    }

    async function loadKeepSnapshot() {
      setKeepLoading(true);
      setKeepErrorMessage("");

      try {
        const response = await fetch("/api/lists");
        const payload = (await response.json()) as ListSnapshot | ApiErrorPayload;

        if (!response.ok) {
          throw new Error(
            "error" in payload
              ? payload.error ?? "Unable to load lists."
              : "Unable to load lists.",
          );
        }

        if (!("notes" in payload)) {
          throw new Error("List data came back in an unexpected format.");
        }

        setKeepSnapshot(payload);
      } catch (error) {
        setKeepErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load lists.",
        );
      } finally {
        setKeepLoading(false);
      }
    }

    void loadKeepSnapshot();
  }, [keepRefreshNonce, page]);

  useEffect(() => {
    try {
      const storedThemeId = window.localStorage.getItem(THEME_STORAGE_KEY);

      if (storedThemeId) {
        setThemeId(getThemeById(storedThemeId).id);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const storedCoords = window.localStorage.getItem(WEATHER_COORDS_STORAGE_KEY);

      if (!storedCoords) {
        return;
      }

      const parsed = JSON.parse(storedCoords) as Partial<SavedWeatherCoords>;

      if (
        typeof parsed.latitude === "number" &&
        Number.isFinite(parsed.latitude) &&
        typeof parsed.longitude === "number" &&
        Number.isFinite(parsed.longitude)
      ) {
        setWeatherCoords({
          latitude: parsed.latitude,
          longitude: parsed.longitude,
        });
      }
    } catch {
      window.localStorage.removeItem(WEATHER_COORDS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    root.dataset.theme = activeTheme.id;
    root.style.colorScheme = activeTheme.colorScheme;

    Object.entries(activeTheme.vars).forEach(([name, value]) => {
      root.style.setProperty(name, value);
    });

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, activeTheme.id);
    } catch {}
  }, [activeTheme]);

  useEffect(() => {
    if (!weatherCoords) {
      return;
    }

    try {
      window.localStorage.setItem(
        WEATHER_COORDS_STORAGE_KEY,
        JSON.stringify(weatherCoords),
      );
    } catch {}
  }, [weatherCoords]);

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(
        HIDDEN_CALENDARS_STORAGE_KEY,
      );

      if (!storedValue) {
        setCalendarPrefsLoaded(true);
        return;
      }

      const parsedValue = JSON.parse(storedValue);

      if (Array.isArray(parsedValue)) {
        setHiddenCalendarIds(
          parsedValue.filter((value): value is string => typeof value === "string"),
        );
      }
    } catch {
      window.localStorage.removeItem(HIDDEN_CALENDARS_STORAGE_KEY);
    } finally {
      setCalendarPrefsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!calendarPrefsLoaded) {
      return;
    }

    window.localStorage.setItem(
      HIDDEN_CALENDARS_STORAGE_KEY,
      JSON.stringify(hiddenCalendarIds),
    );
  }, [calendarPrefsLoaded, hiddenCalendarIds]);

  useEffect(() => {
    if (!calendarPrefsLoaded || calendars.length === 0) {
      return;
    }

    const availableIds = new Set(calendars.map((calendar) => calendar.id));

    setHiddenCalendarIds((current) => {
      const next = current.filter((calendarId) => availableIds.has(calendarId));
      return next.length === current.length ? current : next;
    });
  }, [calendarPrefsLoaded, calendars]);

  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get("authError");

    if (!authError) {
      return;
    }

    setErrorMessage(
      AUTH_ERROR_MESSAGES[authError] ?? "Google sign-in did not complete.",
    );

    const searchParams = new URLSearchParams(window.location.search);
    searchParams.delete("authError");
    const search = searchParams.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`,
    );
  }, []);

  useEffect(() => {
    if (!statusMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setStatusMessage("");
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);

    return () => window.clearInterval(timer);
  }, []);

  function handleNavigate(direction: "prev" | "next") {
    startTransition(() => {
      setAnchorDate((currentDate) => {
        if (view === "day") {
          return addDays(currentDate, direction === "next" ? 1 : -1);
        }

        if (view === "week") {
          return addDays(currentDate, direction === "next" ? 7 : -7);
        }

        return addDays(currentDate, direction === "next" ? 31 : -31);
      });
    });
  }

  function openCreateDialog() {
    setEditorState(createEditorState(anchorDate, writeCalendarId));
  }

  function openEventDetails(event: CalendarEvent) {
    setMoreEventsState(null);
    setEditorState(createEditorStateFromEvent(event));
  }

  function handleJumpToToday() {
    setAnchorDate(new Date());
  }

  function handleToggleCalendarVisibility(calendarId: string) {
    setHiddenCalendarIds((current) =>
      current.includes(calendarId)
        ? current.filter((value) => value !== calendarId)
        : [...current, calendarId],
    );
  }

  function openKeepCreateDialog() {
    setKeepEditorState({
      mode: "create",
      noteId: null,
      draft: createEmptyListDraft(),
      isSelected: true,
      isPinned: false,
    });
  }

  function openKeepNote(note: ListNote) {
    setKeepEditorState({
      mode: "existing",
      noteId: note.id,
      draft: createListDraftFromNote(note),
      isSelected: note.selected,
      isPinned: note.pinned,
    });
  }

  async function patchList(
    noteId: string,
    payload: {
      items?: ListNote["items"];
      pinned?: boolean;
      selected?: boolean;
      text?: string;
      title?: string;
      type?: ListNote["type"];
    },
  ) {
    const response = await fetch(`/api/lists/${noteId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as ListNote | ApiErrorPayload;

    if (!response.ok || !("id" in result)) {
      throw new Error(
        "error" in result
          ? result.error ?? "Unable to update the list."
          : "Unable to update the list.",
      );
    }

    return result;
  }

  function replaceSavedList(savedNote: ListNote) {
    setKeepSnapshot((current) =>
      current
        ? {
            ...current,
            notes: sortNotesByUpdatedAt(
              current.notes
                .filter((note) => note.id !== savedNote.id)
                .concat(savedNote),
            ),
          }
        : {
            source: "database",
            notes: [savedNote],
            capabilities: {
              canCreate: true,
              canDelete: true,
              canUpdateExisting: true,
            },
          },
    );
  }

  async function handleToggleKeepSelection(noteId: string) {
    const note = keepNotes.find((entry) => entry.id === noteId);

    if (!note) {
      return;
    }

    setKeepErrorMessage("");

    try {
      const nextSelected = !note.selected;
      const savedNote = await patchList(noteId, {
        pinned: nextSelected ? note.pinned : false,
        selected: nextSelected,
      });
      replaceSavedList(savedNote);
    } catch (error) {
      setKeepErrorMessage(
        error instanceof Error ? error.message : "Unable to update that list.",
      );
    }
  }

  async function handleToggleKeepPin(noteId: string) {
    const note = keepNotes.find((entry) => entry.id === noteId);

    if (!note) {
      return;
    }

    setKeepErrorMessage("");

    try {
      const savedNote = await patchList(noteId, {
        pinned: !note.pinned,
        selected: true,
      });
      replaceSavedList(savedNote);
    } catch (error) {
      setKeepErrorMessage(
        error instanceof Error ? error.message : "Unable to update that list.",
      );
    }
  }

  async function handleSaveKeepNote() {
    if (!keepEditorState) {
      return;
    }

    const nextDraft = trimListDraft(keepEditorState.draft);

    if (isListDraftEmpty(nextDraft)) {
      setKeepErrorMessage("Add a title, note text, or checklist items first.");
      return;
    }

    setKeepIsSaving(true);
    setKeepErrorMessage("");

    try {
      const response = await fetch(
        keepEditorState.mode === "existing" && keepEditorState.noteId
          ? `/api/lists/${keepEditorState.noteId}`
          : "/api/lists",
        {
          method: keepEditorState.mode === "existing" ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...nextDraft,
            pinned: keepEditorState.isPinned,
            selected: keepEditorState.isSelected,
          }),
        },
      );
      const result = (await response.json()) as ListNote | ApiErrorPayload;

      if (!response.ok || !("id" in result)) {
        throw new Error(
          "error" in result
            ? result.error ?? "Unable to save the list."
            : "Unable to save the list.",
        );
      }

      replaceSavedList(result);
      setKeepEditorState(null);
      setStatusMessage(
        keepEditorState.mode === "existing"
          ? "Saved the list changes."
          : "Created the new list.",
      );
    } catch (error) {
      setKeepErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save the list.",
      );
    } finally {
      setKeepIsSaving(false);
    }
  }

  async function handleDeleteKeepNote() {
    if (!keepEditorState?.noteId) {
      return;
    }

    setKeepIsSaving(true);
    setKeepErrorMessage("");

    try {
      const response = await fetch(`/api/lists/${keepEditorState.noteId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const result = (await response.json()) as ApiErrorPayload;
        throw new Error(
          "error" in result
            ? result.error ?? "Unable to delete the list."
            : "Unable to delete the list.",
        );
      }

      setKeepSnapshot((current) =>
        current
          ? {
              ...current,
              notes: current.notes.filter((note) => note.id !== keepEditorState.noteId),
            }
          : current,
      );
      setKeepEditorState(null);
      setStatusMessage("Deleted the list.");
    } catch (error) {
      setKeepErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete the list.",
      );
    } finally {
      setKeepIsSaving(false);
    }
  }

  async function patchEvent(
    eventId: string,
    payload: {
      calendarId: string;
      title?: string;
      description?: string;
      location?: string;
      start?: string;
      end?: string;
    },
  ) {
    const response = await fetch(`/api/calendar/events/${eventId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as CalendarEvent | ApiErrorPayload;

    if (!response.ok) {
      throw new Error(
        "error" in result
          ? result.error ?? "Unable to update the event."
          : "Unable to update the event.",
      );
    }
  }

  async function handleSaveEvent() {
    if (!editorState) {
      return;
    }

    const [start, end] = editorState.range;

    if (!start || !end) {
      setErrorMessage("Select both a start and end time.");
      return;
    }

    if (end <= start) {
      setErrorMessage("The event end must be after the start.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      if (editorState.mode === "create") {
        const payload: CreateCalendarEventInput = {
          title: editorState.title.trim(),
          description: editorState.description.trim(),
          location: editorState.location.trim(),
          start: start.toISOString(),
          end: end.toISOString(),
        };

        const response = await fetch("/api/calendar/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const result = (await response.json()) as CalendarEvent | ApiErrorPayload;

        if (!response.ok) {
          throw new Error(
            "error" in result
              ? result.error ?? "Unable to create the event."
              : "Unable to create the event.",
          );
        }

        setStatusMessage("Event added to your calendar.");
      } else if (editorState.mode === "edit" && editorState.eventId) {
        await patchEvent(editorState.eventId, {
          calendarId: editorState.calendarId,
          title: editorState.title.trim(),
          description: editorState.description.trim(),
          location: editorState.location.trim(),
          start: start.toISOString(),
          end: end.toISOString(),
        });
        setStatusMessage("Event updated.");
      }

      setEditorState(null);
      setRefreshNonce((current) => current + 1);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to save the event.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function moveDraggedEvent(nextStart: Date, nextEnd: Date) {
    if (!draggedEvent?.editable) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      await patchEvent(draggedEvent.id, {
        calendarId: draggedEvent.calendarId,
        start: nextStart.toISOString(),
        end: nextEnd.toISOString(),
      });
      setStatusMessage(`Moved ${draggedEvent.title}.`);
      setDraggedEvent(null);
      setRefreshNonce((current) => current + 1);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to move the event.",
      );
    } finally {
      setIsSaving(false);
      setDraggedEvent(null);
    }
  }

  async function handleDropOnDay(day: Date) {
    if (!draggedEvent?.editable) {
      return;
    }

    if (draggedEvent.isAllDay) {
      const nextStart = startOfDay(day);
      const nextEnd = addDays(nextStart, 1);
      await moveDraggedEvent(nextStart, nextEnd);
      return;
    }

    const currentStart = parseISO(draggedEvent.start);
    const currentEnd = parseISO(draggedEvent.end);
    const durationMs = Math.max(30 * 60 * 1000, currentEnd.getTime() - currentStart.getTime());
    const nextStart = moveEventToDay(draggedEvent, day);
    const nextEnd = new Date(nextStart.getTime() + durationMs);

    await moveDraggedEvent(nextStart, nextEnd);
  }

  async function handleDropOnSlot(day: Date, hour: number) {
    if (!draggedEvent?.editable) {
      return;
    }

    const currentStart = parseISO(draggedEvent.start);
    const currentEnd = parseISO(draggedEvent.end);
    const durationMs = draggedEvent.isAllDay
      ? 60 * 60 * 1000
      : Math.max(30 * 60 * 1000, currentEnd.getTime() - currentStart.getTime());
    const nextStart = moveEventToSlot(day, hour);
    const nextEnd = new Date(nextStart.getTime() + durationMs);

    await moveDraggedEvent(nextStart, nextEnd);
  }

  async function resolveWeatherCoordinates(forceRelocate = false) {
    if (!forceRelocate && weatherCoords) {
      return weatherCoords;
    }

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      throw new Error("Location services are unavailable in this browser.");
    }

    setWeatherStatus("locating");

    return new Promise<SavedWeatherCoords>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nextCoords = {
            latitude: Number(position.coords.latitude.toFixed(4)),
            longitude: Number(position.coords.longitude.toFixed(4)),
          };

          setWeatherCoords(nextCoords);
          resolve(nextCoords);
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            reject(
              new Error(
                "Allow location access once so the dashboard can show local weather.",
              ),
            );
            return;
          }

          reject(new Error("Unable to determine your current location."));
        },
        {
          enableHighAccuracy: true,
          maximumAge: forceRelocate ? 0 : 10 * 60 * 1000,
          timeout: 10_000,
        },
      );
    });
  }

  async function loadWeather(options?: {
    forceRefresh?: boolean;
    forceRelocate?: boolean;
  }) {
    const forceRefresh = options?.forceRefresh ?? false;
    const forceRelocate = options?.forceRelocate ?? false;

    setWeatherErrorMessage("");

    try {
      const coords = await resolveWeatherCoordinates(forceRelocate);

      setWeatherStatus("loading");

      const search = new URLSearchParams({
        latitude: coords.latitude.toString(),
        longitude: coords.longitude.toString(),
      });

      if (forceRefresh) {
        search.set("refresh", "1");
      }

      const response = await fetch(`/api/weather?${search.toString()}`);
      const result = (await response.json()) as WeatherSnapshot | ApiErrorPayload;

      if (!response.ok || !("current" in result)) {
        throw new Error(
          "error" in result
            ? result.error ?? "Unable to load the weather right now."
            : "Unable to load the weather right now.",
        );
      }

      setWeatherSnapshot(result);
      setWeatherStatus("ready");
    } catch (error) {
      setWeatherErrorMessage(
        error instanceof Error ? error.message : "Unable to load the weather right now.",
      );
      setWeatherStatus("error");
    }
  }

  function handleOpenWeather() {
    setWeatherOpen(true);

    const isStale =
      !weatherSnapshot ||
      Date.now() - new Date(weatherSnapshot.fetchedAt).getTime() >
        WEATHER_SNAPSHOT_TTL_MS;

    if (weatherStatus === "loading" || weatherStatus === "locating") {
      return;
    }

    if (isStale) {
      void loadWeather();
    }
  }

  return (
    <div className={styles.page}>
      {statusMessage ? (
        <div className={styles.floatingAlert}>{statusMessage}</div>
      ) : null}
      {errorMessage ? (
        <div className={styles.floatingAlertError}>{errorMessage}</div>
      ) : null}

      <div
        className={clsx(
          styles.shell,
          styles[`shell${capitalize(displayMode)}` as keyof typeof styles],
          !headerVisible && styles.shellHeaderHidden,
        )}
      >
        {headerVisible ? (
          <header className={styles.headerBar}>
            <div className={styles.headerMain}>
              <div className={styles.headerIdentity}>
                <div className={styles.headerTitleBlock}>
                  <div className={styles.segmentedControl}>
                    {([
                      ["calendar", "Calendar"],
                      ["lists", "Lists"],
                    ] as const).map(([nextPage, label]) => (
                      <button
                        key={nextPage}
                        type="button"
                        className={clsx(
                          styles.segmentedButton,
                          page === nextPage && styles.segmentedButtonActive,
                        )}
                        onClick={() => setPage(nextPage)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className={styles.toolbarLabel}>
                    {page === "calendar" ? "Home schedule hub" : "Shared lists"}
                  </p>
                  <div className={styles.headerTitleRow}>
                    <h1 className={styles.headerTitle}>{headerTitle}</h1>
                    <span className={styles.headerMetaDivider} />
                    <span className={styles.headerHint}>{headerHint}</span>
                  </div>
                </div>
              </div>

              <div className={styles.headerControls}>
                <ThemeCycleButton
                  themeName={activeTheme.shortLabel}
                  onClick={() => {
                    startTransition(() => {
                      setThemeId((currentThemeId) => getNextThemeId(currentThemeId));
                    });
                  }}
                />
                <FloatingNowChip now={now} onClick={handleOpenWeather} />
                {/* <DisplayModeBadge mode={displayMode} /> */}
              </div>
            </div>
          </header>
        ) : (
          <>
            <HeaderToggle
              expanded={false}
              className={styles.headerReveal}
              onClick={() => setHeaderVisible(true)}
            />

            <FloatingNowChip
              floating
              now={now}
              onClick={handleOpenWeather}
            />
          </>
        )}

        <main className={styles.stage}>
          <section
            className={clsx(
              styles.board,
              (page === "calendar" ? isLoading : keepLoading) && styles.boardBusy,
            )}
          >
            <div className={styles.boardToolbar}>
              {page === "calendar" ? (
                <>
                  <div className={styles.boardToolbarStart}>
                    <div className={styles.segmentedControl}>
                      {(["day", "week", "month"] as const).map((calendarView) => (
                        <button
                          key={calendarView}
                          type="button"
                          className={clsx(
                            styles.segmentedButton,
                            view === calendarView && styles.segmentedButtonActive,
                          )}
                          onClick={() => setView(calendarView)}
                        >
                          {calendarView}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      className={styles.controlButton}
                      onClick={handleJumpToToday}
                    >
                      Today
                    </button>
                  </div>

                  <div className={styles.boardRangeNav}>
                    <button
                      type="button"
                      className={styles.navLabelButton}
                      onClick={() => handleNavigate("prev")}
                      aria-label={`Previous ${view}`}
                    >
                      <ArrowLeft size={16} />
                      <span>{prevLabel}</span>
                    </button>

                    <div className={styles.boardTitleWrap}>
                      <p className={styles.toolbarLabel}>Viewing</p>
                      <h2 className={styles.boardTitle}>{boardTitle}</h2>
                    </div>

                    <button
                      type="button"
                      className={styles.navLabelButton}
                      onClick={() => handleNavigate("next")}
                      aria-label={`Next ${view}`}
                    >
                      <span>{nextLabel}</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.boardToolbarStart}>
                    <button
                      type="button"
                      className={styles.controlButton}
                      onClick={() => setKeepSelectorOpen(true)}
                    >
                      Choose lists
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => setKeepRefreshNonce((current) => current + 1)}
                    >
                      Refresh
                    </button>
                  </div>

                  <div className={styles.boardTitleWrap}>
                    <p className={styles.toolbarLabel}>Viewing</p>
                    <h2 className={styles.boardTitle}>Lists</h2>
                    <p className={styles.fieldHelp}>
                      {selectedKeepNotes.length} selected list
                      {selectedKeepNotes.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </>
              )}

              <div className={styles.boardToolbarEnd}>
                <HeaderToggle
                  expanded
                  onClick={() => setHeaderVisible(false)}
                />
              </div>
            </div>

            <div className={styles.boardBody}>
              {page === "calendar" ? (
                isLoading && !snapshot ? (
                  <div className={styles.loadingState}>
                    <LoaderCircle className={styles.inlineSpinner} />
                    <p>Loading calendar events.</p>
                  </div>
                ) : snapshot ? (
                  view === "month" ? (
                    <MonthView
                      anchorDate={anchorDate}
                      displayMode={displayMode}
                      draggedEvent={draggedEvent}
                      groupedEvents={groupedEvents}
                      onDropDay={(day) => void handleDropOnDay(day)}
                      onEventClick={openEventDetails}
                      onEventDragStart={setDraggedEvent}
                      onMoreEvents={(date) =>
                        setMoreEventsState({
                          date,
                          events: groupedEvents[format(date, "yyyy-MM-dd")] ?? [],
                        })
                      }
                      visibleCount={visibleMonthEventCount}
                    />
                  ) : view === "week" ? (
                    <WeekTimelineView
                      anchorDate={anchorDate}
                      draggedEvent={draggedEvent}
                      events={events}
                      onDropSlot={(day, hour) => void handleDropOnSlot(day, hour)}
                      onEventClick={openEventDetails}
                      onEventDragStart={setDraggedEvent}
                    />
                  ) : (
                    <DayClockView
                      date={anchorDate}
                      events={currentDayEvents}
                      onDropHour={(hour) => void handleDropOnSlot(anchorDate, hour)}
                      onEventClick={openEventDetails}
                      onEventDragStart={setDraggedEvent}
                    />
                  )
                ) : (
                  <div className={styles.contentEmpty}>
                    <h3>Calendar unavailable</h3>
                    <p>Reload the page or open the account panel to reconnect Google.</p>
                  </div>
                )
              ) : (
                <KeepDashboard
                  errorMessage={keepErrorMessage}
                  isLoading={keepLoading}
                  onCreateNote={openKeepCreateDialog}
                  onNoteClick={openKeepNote}
                  onOpenSelector={() => setKeepSelectorOpen(true)}
                  onRefresh={() => setKeepRefreshNonce((current) => current + 1)}
                  onTogglePin={handleToggleKeepPin}
                  pinnedNotes={pinnedKeepNotes}
                  regularNotes={regularKeepNotes}
                  source={keepSnapshot?.source ?? "mock"}
                />
              )}
            </div>
          </section>
        </main>
      </div>

      <AccountFab
        onClick={() => setAccountOpen(true)}
        user={activeUser}
      />

      <ComposeFab
        label={page === "calendar" ? "Add event" : "New list"}
        onClick={page === "calendar" ? openCreateDialog : openKeepCreateDialog}
      />

      {accountOpen ? (
        <DialogShell
          onClose={() => setAccountOpen(false)}
          title="Google account"
          titleLabel="Google account"
        >
          <AccountPanel
            authStatus={authStatus}
            calendars={calendars}
            googleClientId={googleClientId}
            hiddenCalendarIds={hiddenCalendarIds}
            onToggleCalendarVisibility={handleToggleCalendarVisibility}
            user={activeUser}
          />
        </DialogShell>
      ) : null}

      {editorState ? (
        <DialogShell
          onClose={() => setEditorState(null)}
          title={
            editorState.mode === "create"
              ? "Schedule something"
              : (
                  <LinkifiedText
                    text={editorState.title || "Event details"}
                  />
                )
          }
          titleLabel={
            editorState.mode === "create"
              ? "Schedule something"
              : editorState.title || "Event details"
          }
        >
          <EventEditorPanel
            canSave={canSaveEditor}
            editorState={editorState}
            isSaving={isSaving}
            onChange={setEditorState}
            onEdit={() =>
              setEditorState((current) =>
                current
                  ? {
                      ...current,
                      mode: "edit",
                    }
                  : current,
              )
            }
            onSave={() => void handleSaveEvent()}
          />
        </DialogShell>
      ) : null}

      {moreEventsState ? (
        <DialogShell
          hideHeader
          onClose={() => setMoreEventsState(null)}
          shellClassName={styles.modalShellWide}
          title={format(moreEventsState.date, "EEEE, MMMM d")}
          titleLabel={format(moreEventsState.date, "EEEE, MMMM d")}
        >
          <DayClockView
            date={moreEventsState.date}
            events={moreEventsState.events}
            onDropHour={(hour) => void handleDropOnSlot(moreEventsState.date, hour)}
            onEventClick={openEventDetails}
            onEventDragStart={setDraggedEvent}
          />
        </DialogShell>
      ) : null}

      {weatherOpen ? (
        <DialogShell
          hideHeader
          onClose={() => setWeatherOpen(false)}
          shellClassName={styles.modalShellWide}
          title="Weather"
          titleLabel="Weather"
        >
          <WeatherPanel
            errorMessage={weatherErrorMessage}
            onRefresh={() => void loadWeather({ forceRefresh: true })}
            snapshot={weatherSnapshot}
            status={weatherStatus}
          />
        </DialogShell>
      ) : null}

      {keepSelectorOpen ? (
        <DialogShell
          onClose={() => setKeepSelectorOpen(false)}
          title="Choose dashboard lists"
          titleLabel="Choose dashboard lists"
        >
          <KeepSelectionPanel
            notes={sortNotesByUpdatedAt(keepNotes)}
            onCreateNote={() => {
              setKeepSelectorOpen(false);
              openKeepCreateDialog();
            }}
            onTogglePin={handleToggleKeepPin}
            onToggleSelection={handleToggleKeepSelection}
            pinnedNoteIds={keepNotes.filter((note) => note.pinned).map((note) => note.id)}
            selectedNoteIds={selectedKeepNotes.map((note) => note.id)}
          />
        </DialogShell>
      ) : null}

      {keepEditorState ? (
        <DialogShell
          onClose={() => setKeepEditorState(null)}
          title={keepEditorState.draft.title || "List"}
          titleLabel={keepEditorState.draft.title || "List"}
        >
          <KeepNotePanel
            editorState={keepEditorState}
            isSaving={keepIsSaving}
            onChange={setKeepEditorState}
            onDelete={() => void handleDeleteKeepNote()}
            onSave={() => void handleSaveKeepNote()}
            onTogglePin={() => {
              setKeepEditorState((current) =>
                current
                  ? {
                      ...current,
                      isPinned: !current.isPinned,
                    }
                  : current,
              );
            }}
          />
        </DialogShell>
      ) : null}
    </div>
  );
}
