"use client";

import clsx from "clsx";
import { format } from "date-fns";
import {
  Clock3,
  CloudSun,
  ChevronDown,
  ChevronUp,
  Grip,
  MapPin,
  MonitorSmartphone,
  Palette,
  Plus,
  Smartphone,
  TabletSmartphone,
  UserRound,
  X,
} from "lucide-react";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

import styles from "./family-calendar-app.module.css";
import { formatEventTime } from "./calendar-helpers";
import type { CalendarEvent, CalendarUser } from "@/lib/calendar/types";
import type { DisplayMode } from "@/lib/display-mode";

const URL_PATTERN = /(https?:\/\/[^\s<]+)/g;
const URL_SEGMENT_PATTERN = /^https?:\/\/[^\s<]+$/;

export function LinkifiedText({
  linkClassName,
  text,
}: {
  linkClassName?: string;
  text: string;
}) {
  const parts = text.split(URL_PATTERN);

  return (
    <>
      {parts.map((part, index) =>
        URL_SEGMENT_PATTERN.test(part) ? (
          <a
            key={`${part}-${index}`}
            className={linkClassName ?? styles.inlineTextLink}
            href={part}
            rel="noreferrer noopener"
            target="_blank"
          >
            {part}
          </a>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

export function DisplayModeBadge({ mode }: { mode: DisplayMode }) {
  if (mode === "mobile") {
    return (
      <span className={styles.modeBadge}>
        <Smartphone size={16} />
        Mobile
      </span>
    );
  }

  if (mode === "kiosk") {
    return (
      <span className={styles.modeBadge}>
        <MonitorSmartphone size={16} />
        Kiosk
      </span>
    );
  }

  return (
    <span className={styles.modeBadge}>
      <TabletSmartphone size={16} />
      Desktop
    </span>
  );
}

export function HeaderToggle({
  expanded,
  className,
  onClick,
}: {
  expanded: boolean;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={clsx(styles.iconButton, className)}
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={expanded ? "Collapse header" : "Expand header"}
    >
      {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
    </button>
  );
}

export function FloatingNowChip({
  floating = false,
  now,
  onClick,
}: {
  floating?: boolean;
  now: Date;
  onClick: () => void;
}) {
  const [isHeld, setIsHeld] = useState(false);
  const [isClickPressed, setIsClickPressed] = useState(false);

  useEffect(() => {
    if (!isClickPressed) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setIsClickPressed(false);
    }, 170);

    return () => window.clearTimeout(timeoutId);
  }, [isClickPressed]);

  const pressed = isHeld || isClickPressed;

  return (
    <button
      type="button"
      className={clsx(
        styles.nowChip,
        pressed && styles.nowChipPressed,
        floating && styles.nowChipFloating,
      )}
      onClick={() => {
        setIsClickPressed(true);
        onClick();
      }}
      onPointerDown={() => setIsHeld(true)}
      onPointerLeave={() => setIsHeld(false)}
      onPointerUp={() => setIsHeld(false)}
      aria-label="Open local weather"
    >
      <span className={styles.nowChipTop}>
        <CloudSun size={16} className={styles.nowChipIcon} />
        <span>{format(now, "EEE, MMM d")}</span>
      </span>
      <span className={styles.nowChipBottom}>
        <Clock3 size={15} className={styles.nowChipIcon} />
        <strong>{format(now, "h:mm a")}</strong>
      </span>
    </button>
  );
}

export function ThemeCycleButton({
  themeName,
  onClick,
}: {
  themeName: string;
  onClick: () => void;
}) {
  const [isHeld, setIsHeld] = useState(false);
  const [isClickPressed, setIsClickPressed] = useState(false);

  useEffect(() => {
    if (!isClickPressed) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setIsClickPressed(false);
    }, 170);

    return () => window.clearTimeout(timeoutId);
  }, [isClickPressed]);

  const pressed = isHeld || isClickPressed;

  return (
    <button
      type="button"
      className={clsx(styles.themeButton, pressed && styles.themeButtonPressed)}
      onClick={() => {
        setIsClickPressed(true);
        onClick();
      }}
      onPointerDown={() => setIsHeld(true)}
      onPointerLeave={() => setIsHeld(false)}
      onPointerUp={() => setIsHeld(false)}
      aria-label={`Switch to the next theme. Current theme: ${themeName}.`}
      title={`Current theme: ${themeName}`}
    >
      <span className={styles.themeButtonIconWrap} aria-hidden="true">
        <Palette size={18} />
      </span>
      <span className={styles.themeButtonCopy}>
        <span className={styles.themeButtonMeta}>Theme</span>
        <strong className={styles.themeButtonName}>{themeName}</strong>
      </span>
    </button>
  );
}

export function AccountFab({
  onClick,
  user,
}: {
  onClick: () => void;
  user: CalendarUser | null;
}) {
  return (
    <button type="button" className={styles.accountFab} onClick={onClick}>
      {user?.picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.picture} alt={user.name} className={styles.accountFabAvatar} />
      ) : (
        <UserRound size={20} />
      )}
      <span>{user ? user.name.split(" ")[0] : "Google"}</span>
    </button>
  );
}

export function ComposeFab({
  label = "Add event",
  onClick,
}: {
  label?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.composeFab} onClick={onClick}>
      <Plus size={20} />
      <span>{label}</span>
    </button>
  );
}

export function DialogShell({
  children,
  hideHeader = false,
  onClose,
  shellClassName,
  title,
  titleLabel,
}: {
  children: React.ReactNode;
  hideHeader?: boolean;
  onClose: () => void;
  shellClassName?: string;
  title: React.ReactNode;
  titleLabel?: string;
}) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={clsx(styles.modalShell, shellClassName)}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={titleLabel ?? (typeof title === "string" ? title : "Dialog")}
      >
        {hideHeader ? (
          <button
            type="button"
            className={clsx(styles.iconButton, styles.modalCloseButton)}
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        ) : (
          <div className={styles.modalHeader}>
            <div>
              <p className={styles.toolbarLabel}>Details</p>
              <h2>{title}</h2>
            </div>
            <button type="button" className={styles.iconButton} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function EventSurface({
  event,
  onClick,
  onDragStart,
  style,
  variant,
}: {
  event: CalendarEvent;
  onClick: () => void;
  onDragStart: (event: CalendarEvent | null) => void;
  style?: React.CSSProperties;
  variant: "compact" | "full" | "mini" | "timeline";
}) {
  const isSingleLine =
    variant === "compact" || variant === "mini" || variant === "timeline";
  const showLocation =
    event.location.trim().length > 0 &&
    event.location.trim().toLowerCase() !== "home";

  return (
    <button
      type="button"
      className={clsx(
        styles.eventSurface,
        styles[`eventSurface${variant[0].toUpperCase()}${variant.slice(1)}` as keyof typeof styles],
        !event.editable && styles.eventSurfaceReadOnly,
      )}
      draggable={event.editable}
      onClick={onClick}
      onDragStart={(dragEvent) => {
        dragEvent.dataTransfer.effectAllowed = "move";
        onDragStart(event);
      }}
      onDragEnd={() => onDragStart(null)}
      style={style}
    >
      <div className={styles.eventAccent} style={{ backgroundColor: event.calendarColor }} />
      <div className={styles.eventSurfaceBody}>
        {isSingleLine ? (
          <div className={styles.eventInlineRow}>
            <strong className={styles.eventInlineTitle}>{event.title}</strong>
            <span className={styles.eventInlineDivider}>•</span>
            <span className={styles.eventInlineTime}>
              {formatEventTime(event.start, event.end, event.isAllDay)}
            </span>
          </div>
        ) : (
          <>
            {event.editable ? (
              <div className={styles.eventSurfaceMeta}>
                <span className={styles.eventEditableHint}>
                  <Grip size={14} />
                  Move
                </span>
              </div>
            ) : null}
            <strong>{event.title}</strong>
            <span>{formatEventTime(event.start, event.end, event.isAllDay)}</span>
            {variant === "full" && showLocation ? (
              <span className={styles.eventLocation}>
                <MapPin size={14} />
                {event.location}
              </span>
            ) : null}
            {variant === "full" && event.description ? (
              <p className={styles.eventDescription}>{event.description}</p>
            ) : null}
          </>
        )}
      </div>
    </button>
  );
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number | boolean>,
          ) => void;
        };
      };
    };
  }
}

export function GoogleSignInButton({ clientId }: { clientId: string }) {
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const [isScriptReady, setIsScriptReady] = useState(false);
  const [buttonError, setButtonError] = useState("");

  useEffect(() => {
    const handleCredentialResponse = async (response: { credential?: string }) => {
      if (!response.credential) {
        setButtonError("Google sign-in did not return an ID token.");
        return;
      }

      setButtonError("");

      try {
        const loginResponse = await fetch("/api/auth/google/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            credential: response.credential,
          }),
        });
        const payload = (await loginResponse.json()) as {
          error?: string;
          redirectTo?: string;
        };

        if (!loginResponse.ok || !payload.redirectTo) {
          throw new Error(payload.error ?? "Google login could not be started.");
        }

        window.location.href = payload.redirectTo;
      } catch (error) {
        setButtonError(
          error instanceof Error ? error.message : "Google login could not be started.",
        );
      }
    };

    const renderButton = () => {
      if (!isScriptReady || !buttonRef.current || !window.google || !clientId) {
        return;
      }

      const width = Math.max(240, Math.min(360, buttonRef.current.offsetWidth || 320));
      buttonRef.current.innerHTML = "";

      window.google.accounts.id.initialize({
        auto_select: false,
        callback: handleCredentialResponse,
        client_id: clientId,
        context: "signin",
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        logo_alignment: "left",
        shape: "pill",
        size: "large",
        text: "continue_with",
        theme: "outline",
        width,
      });
    };

    renderButton();
    const handleResize = () => renderButton();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [clientId, isScriptReady]);

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setIsScriptReady(true)}
      />
      <div ref={buttonRef} className={styles.googleButtonSlot} />
      {buttonError ? <p className={styles.fieldHelp}>{buttonError}</p> : null}
    </>
  );
}
