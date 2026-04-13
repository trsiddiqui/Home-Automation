"use client";

import clsx from "clsx";
import DatePicker from "react-datepicker";
import { CalendarPlus2, LoaderCircle, Pencil } from "lucide-react";

import styles from "./family-calendar-app.module.css";
import { formatRange } from "./calendar-helpers";
import { GoogleSignInButton, LinkifiedText } from "./calendar-shared";
import type { EventEditorState } from "./calendar-ui-types";
import type { CalendarSnapshot, CalendarSource, CalendarUser } from "@/lib/calendar/types";

const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;
const ALLOWED_HTML_TAGS = new Set([
  "a",
  "b",
  "br",
  "div",
  "em",
  "i",
  "li",
  "ol",
  "p",
  "span",
  "strong",
  "u",
  "ul",
]);
const STRIP_HTML_TAGS = new Set(["embed", "iframe", "link", "meta", "object", "script", "style"]);

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function hasRichHtml(value: string) {
  return HTML_TAG_PATTERN.test(value);
}

function isSafeExternalUrl(value: string) {
  return /^https?:\/\//i.test(value) || /^mailto:/i.test(value);
}

function sanitizeRichHtml(html: string) {
  if (typeof DOMParser === "undefined") {
    return escapeHtml(html);
  }

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(html, "text/html");

  function sanitizeElement(element: Element) {
    for (const child of Array.from(element.children)) {
      const tagName = child.tagName.toLowerCase();

      if (STRIP_HTML_TAGS.has(tagName)) {
        child.remove();
        continue;
      }

      if (!ALLOWED_HTML_TAGS.has(tagName)) {
        child.replaceWith(documentNode.createTextNode(child.textContent ?? ""));
        continue;
      }

      const href =
        tagName === "a" ? child.getAttribute("href")?.trim() ?? "" : "";

      for (const attribute of Array.from(child.attributes)) {
        child.removeAttribute(attribute.name);
      }

      if (tagName === "a") {
        if (isSafeExternalUrl(href)) {
          child.setAttribute("href", href);
          child.setAttribute("rel", "noreferrer noopener");
          child.setAttribute("target", "_blank");
        } else {
          child.removeAttribute("href");
        }
      }

      sanitizeElement(child);
    }
  }

  sanitizeElement(documentNode.body);
  return documentNode.body.innerHTML;
}

export function AccountPanel({
  authStatus,
  calendars,
  googleClientId,
  hiddenCalendarIds,
  onToggleCalendarVisibility,
  user,
}: {
  authStatus: CalendarSnapshot["auth"]["status"];
  calendars: CalendarSource[];
  googleClientId: string;
  hiddenCalendarIds: string[];
  onToggleCalendarVisibility: (calendarId: string) => void;
  user: CalendarUser | null;
}) {
  if (authStatus === "connected") {
    return (
      <div className={styles.accountPanel}>
        <div className={styles.accountIdentity}>
          {user?.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.picture} alt={user.name} className={styles.accountAvatar} />
          ) : (
            <div className={styles.avatarFallback}>
              {user?.name?.slice(0, 1).toUpperCase() ?? "G"}
            </div>
          )}
          <div>
            <strong>{user?.name}</strong>
            <span>{user?.email}</span>
          </div>
        </div>

        <p className={styles.modalBodyCopy}>
          Shared calendars stay readable, while only the configured writable calendar
          can be edited and dragged.
        </p>

        <p className={styles.fieldHelp}>
          Use the switches below to hide calendars on this device. Your choice is
          saved here and reused on the next load.
        </p>

        <div className={styles.accountCalendarList}>
          {calendars.map((calendar) => {
            const isVisible = !hiddenCalendarIds.includes(calendar.id);

            return (
              <div
                key={calendar.id}
                className={clsx(
                  styles.accountCalendarRow,
                  !isVisible && styles.accountCalendarRowHidden,
                )}
              >
                <div className={styles.accountCalendarContent}>
                  <span
                    className={styles.calendarDot}
                    style={{ backgroundColor: calendar.color }}
                  />
                  <div className={styles.accountCalendarCopy}>
                    <strong>{calendar.name}</strong>
                    <span>{calendar.writable ? "Editable" : "Read only"}</span>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={isVisible}
                  aria-label={`${isVisible ? "Hide" : "Show"} ${calendar.name}`}
                  className={clsx(
                    styles.calendarVisibilityToggle,
                    isVisible && styles.calendarVisibilityToggleActive,
                  )}
                  onClick={() => onToggleCalendarVisibility(calendar.id)}
                >
                  <span className={styles.calendarVisibilityLabel}>
                    {isVisible ? "Shown" : "Hidden"}
                  </span>
                  <span className={styles.calendarVisibilityTrack}>
                    <span className={styles.calendarVisibilityThumb} />
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <form action="/api/auth/logout" method="post">
          <button type="submit" className={styles.secondaryButton}>
            Sign out
          </button>
        </form>
      </div>
    );
  }

  if (authStatus === "missing_configuration") {
    return (
      <div className={styles.accountPanel}>
        <p className={styles.modalBodyCopy}>
          Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env.local` first.
        </p>
      </div>
    );
  }

  return (
      <div className={styles.accountPanel}>
        <p className={styles.modalBodyCopy}>
          Sign in with Google to unlock your real calendars, editing, and
          drag-and-drop.
        </p>
      {googleClientId ? (
        <GoogleSignInButton clientId={googleClientId} />
      ) : (
        <p className={styles.modalBodyCopy}>
          The Google client ID is missing, so the sign-in button cannot render.
        </p>
      )}
    </div>
  );
}

export function EventEditorPanel({
  canSave,
  editorState,
  isSaving,
  onChange,
  onEdit,
  onSave,
}: {
  canSave: boolean;
  editorState: EventEditorState;
  isSaving: boolean;
  onChange: (state: EventEditorState) => void;
  onEdit: () => void;
  onSave: () => void;
}) {
  const isReadOnly = editorState.mode === "view" || !editorState.editable;
  const hasLocation = editorState.location.trim().length > 0;
  const hasNotes = editorState.description.trim().length > 0;
  const renderedNotesHtml =
    isReadOnly && hasNotes && hasRichHtml(editorState.description)
      ? sanitizeRichHtml(editorState.description)
      : "";

  return (
    <div className={styles.editorPanel}>
      <div className={styles.editorHeader}>
        <div>
          <p className={styles.toolbarLabel}>Calendar</p>
          <h3>
            {editorState.mode === "create"
              ? "New event"
              : editorState.editable
                ? "Editable event"
                : "Read-only event"}
          </h3>
        </div>

        {editorState.editable && editorState.mode === "view" ? (
          <button type="button" className={styles.secondaryButton} onClick={onEdit}>
            <Pencil size={16} />
            Edit
          </button>
        ) : null}
      </div>

      <div className={styles.editorGrid}>
        {!isReadOnly ? (
          <label className={styles.field}>
            <span>Description</span>
            <input
              disabled={isReadOnly}
              value={editorState.title}
              onChange={(event) =>
                onChange({
                  ...editorState,
                  title: event.target.value,
                })
              }
              placeholder="Doctor visit, lunch, school pickup"
            />
          </label>
        ) : null}

        {!isReadOnly || hasLocation ? (
          <label className={styles.field}>
            <span>Location</span>
            {isReadOnly ? (
              <div className={styles.readOnlyField}>{editorState.location}</div>
            ) : (
              <input
                disabled={isReadOnly}
                value={editorState.location}
                onChange={(event) =>
                  onChange({
                    ...editorState,
                    location: event.target.value,
                  })
                }
                placeholder="Clinic, home, downtown"
              />
            )}
          </label>
        ) : null}

        {!isReadOnly || hasNotes ? (
          <label className={styles.field}>
            <span>Notes</span>
            {isReadOnly ? (
              renderedNotesHtml ? (
                <div
                  className={clsx(styles.readOnlyField, styles.readOnlyRichText)}
                  dangerouslySetInnerHTML={{ __html: renderedNotesHtml }}
                />
              ) : (
                <div className={styles.readOnlyField}>
                  <LinkifiedText text={editorState.description} />
                </div>
              )
            ) : (
              <textarea
                disabled={isReadOnly}
                rows={4}
                value={editorState.description}
                onChange={(event) =>
                  onChange({
                    ...editorState,
                    description: event.target.value,
                  })
                }
                placeholder="Anything the family should know"
              />
            )}
          </label>
        ) : null}

        <div className={styles.rangeField}>
          <span>Date range</span>
          {isReadOnly ? (
            <div className={styles.rangeReadOnly}>
              {formatRange(editorState.range[0], editorState.range[1])}
            </div>
          ) : (
            <div className={styles.rangePickerShell}>
              <DatePicker
                endDate={editorState.range[1]}
                inline
                onChange={(update) =>
                  onChange({
                    ...editorState,
                    range: update as [Date | null, Date | null],
                  })
                }
                selectsRange
                showTimeSelect
                startDate={editorState.range[0]}
                timeFormat="h:mm aa"
                timeIntervals={15}
                dateFormat="MMM d, yyyy h:mm aa"
              />
            </div>
          )}
        </div>
      </div>

      {canSave ? (
        <button type="button" className={styles.primaryButton} onClick={onSave}>
          {isSaving ? (
            <>
              <LoaderCircle className={styles.inlineSpinner} />
              Saving
            </>
          ) : (
            <>
              <CalendarPlus2 size={18} />
              Save event
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}
