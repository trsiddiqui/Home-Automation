"use client";

import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  Check,
  LoaderCircle,
  Pin,
  Plus,
  Search,
  Square,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import styles from "./family-calendar-app.module.css";
import type { KeepEditorState } from "./keep-ui-types";
import {
  appendListItemAtPath,
  moveListItemAtPath,
  removeListItemAtPath,
  updateListItemsAtPath,
} from "@/lib/lists/helpers";
import type { ListItem, ListNote, ListSnapshot } from "@/lib/lists/types";

function flattenChecklistPreview(items: ListItem[], depth = 0): Array<{
  checked: boolean;
  depth: number;
  id: string;
  text: string;
}> {
  return items.flatMap((item) => [
    {
      checked: item.checked,
      depth,
      id: item.id,
      text: item.text,
    },
    ...flattenChecklistPreview(item.children, depth + 1),
  ]);
}

function getListPreviewText(note: ListNote) {
  if (note.type === "text") {
    return note.text.trim();
  }

  return flattenChecklistPreview(note.items)
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join(" ");
}

function countChecklistItems(items: ListItem[]): number {
  return items.reduce(
    (count, item) => count + 1 + countChecklistItems(item.children),
    0,
  );
}

function KeepCard({
  isPinned,
  note,
  onClick,
  onTogglePin,
}: {
  isPinned: boolean;
  note: ListNote;
  onClick: () => void;
  onTogglePin: () => void;
}) {
  const previewItems = flattenChecklistPreview(note.items).slice(0, 5);
  const previewText = getListPreviewText(note);
  const itemCount =
    note.type === "checklist"
      ? countChecklistItems(note.items)
      : Math.max(1, previewText.split(/\n+/).filter(Boolean).length);

  return (
    <article className={styles.keepCard}>
      <div className={styles.keepCardTop}>
        <span className={styles.keepCardType}>
          {note.type === "checklist" ? "Checklist" : "Note"}
        </span>
        <button
          type="button"
          className={clsx(styles.keepPinButton, isPinned && styles.keepPinButtonActive)}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePin();
          }}
          aria-label={isPinned ? `Unpin ${note.title}` : `Pin ${note.title}`}
        >
          <Pin size={14} />
        </button>
      </div>

      <button type="button" className={styles.keepCardOpen} onClick={onClick}>
        <div className={styles.keepCardBody}>
          <h3 className={styles.keepCardTitle}>{note.title || "Untitled list"}</h3>

          {note.type === "checklist" ? (
            <ul className={styles.keepCardChecklist}>
              {previewItems.length > 0 ? (
                previewItems.map((item) => (
                  <li key={item.id} className={styles.keepCardChecklistItem}>
                    <span className={styles.keepCardChecklistMark}>
                      {item.checked ? <Check size={12} /> : <Square size={12} />}
                    </span>
                    <span
                      className={clsx(
                        styles.keepCardChecklistText,
                        item.checked && styles.keepCardChecklistTextChecked,
                      )}
                      style={{ paddingLeft: `${item.depth * 12}px` }}
                    >
                      {item.text || "Untitled item"}
                    </span>
                  </li>
                ))
              ) : (
                <li className={styles.keepCardChecklistItemMuted}>Empty checklist</li>
              )}
            </ul>
          ) : (
            <p className={styles.keepCardTextPreview}>
              {previewText || "Empty note"}
            </p>
          )}
        </div>

        <div className={styles.keepCardMeta}>
          <span>
            {itemCount} {itemCount === 1 ? "line" : "lines"}
          </span>
          <span>
            Updated {formatDistanceToNow(new Date(note.updateTime), { addSuffix: true })}
          </span>
        </div>
      </button>
    </article>
  );
}

export function KeepDashboard({
  errorMessage,
  isLoading,
  onCreateNote,
  onNoteClick,
  onOpenSelector,
  onRefresh,
  onTogglePin,
  pinnedNotes,
  regularNotes,
  source,
}: {
  errorMessage: string;
  isLoading: boolean;
  onCreateNote: () => void;
  onNoteClick: (note: ListNote) => void;
  onOpenSelector: () => void;
  onRefresh: () => void;
  onTogglePin: (noteId: string) => void;
  pinnedNotes: ListNote[];
  regularNotes: ListNote[];
  source: ListSnapshot["source"];
}) {
  if (isLoading && pinnedNotes.length === 0 && regularNotes.length === 0) {
    return (
      <div className={styles.loadingState}>
        <LoaderCircle className={styles.inlineSpinner} />
        <p>Loading lists.</p>
      </div>
    );
  }

  if (errorMessage && pinnedNotes.length === 0 && regularNotes.length === 0) {
    return (
      <div className={styles.contentEmpty}>
        <h3>Lists unavailable</h3>
        <p className={styles.emptyStateText}>{errorMessage}</p>
        <div className={styles.keepEmptyActions}>
          <button type="button" className={styles.primaryButton} onClick={onRefresh}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (pinnedNotes.length === 0 && regularNotes.length === 0) {
    return (
      <div className={styles.contentEmpty}>
        <h3>No lists selected</h3>
        <p className={styles.emptyStateText}>
          Choose the lists you want on this dashboard, then open any card to edit it
          in a larger detail view.
        </p>
        <div className={styles.keepEmptyActions}>
          <button type="button" className={styles.primaryButton} onClick={onOpenSelector}>
            Choose lists
          </button>
          <button type="button" className={styles.secondaryButton} onClick={onCreateNote}>
            New list
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.keepDashboard}>
      {errorMessage ? <p className={styles.fieldHelp}>{errorMessage}</p> : null}
      {source === "mock" ? (
        <p className={styles.fieldHelp}>
          Using demo lists because `DATABASE_URL` is not configured yet.
        </p>
      ) : null}

      {pinnedNotes.length > 0 ? (
        <section className={styles.keepSection}>
          <div className={styles.keepSectionHeader}>
            <div>
              <p className={styles.toolbarLabel}>Pinned</p>
              <h3>Pinned first</h3>
            </div>
            <span className={styles.keepSectionCount}>
              {pinnedNotes.length} selected
            </span>
          </div>
          <div className={styles.keepGrid}>
            {pinnedNotes.map((note) => (
              <KeepCard
                key={note.id}
                isPinned
                note={note}
                onClick={() => onNoteClick(note)}
                onTogglePin={() => onTogglePin(note.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.keepSection}>
        <div className={styles.keepSectionHeader}>
          <div>
            <p className={styles.toolbarLabel}>Dashboard</p>
            <h3>
              {regularNotes.length > 0 ? "Selected lists" : "Only pinned lists are selected"}
            </h3>
          </div>
          <span className={styles.keepSectionCount}>
            {regularNotes.length} visible
          </span>
        </div>
        <div className={styles.keepGrid}>
          {regularNotes.map((note) => (
            <KeepCard
              key={note.id}
              isPinned={false}
              note={note}
              onClick={() => onNoteClick(note)}
              onTogglePin={() => onTogglePin(note.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export function KeepSelectionPanel({
  notes,
  onCreateNote,
  onTogglePin,
  onToggleSelection,
  pinnedNoteIds,
  selectedNoteIds,
}: {
  notes: ListNote[];
  onCreateNote: () => void;
  onTogglePin: (noteId: string) => void;
  onToggleSelection: (noteId: string) => void;
  pinnedNoteIds: string[];
  selectedNoteIds: string[];
}) {
  const [query, setQuery] = useState("");
  const selectedNoteIdSet = useMemo(
    () => new Set(selectedNoteIds),
    [selectedNoteIds],
  );
  const pinnedNoteIdSet = useMemo(() => new Set(pinnedNoteIds), [pinnedNoteIds]);
  const filteredNotes = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();

    if (!trimmedQuery) {
      return notes;
    }

    return notes.filter((note) => {
      const haystack = `${note.title} ${getListPreviewText(note)}`.toLowerCase();
      return haystack.includes(trimmedQuery);
    });
  }, [notes, query]);

  return (
    <div className={styles.keepSelectorPanel}>
      <div className={styles.keepSelectorTop}>
        <div>
          <p className={styles.toolbarLabel}>Selection</p>
          <h3>Choose which lists stay on the dashboard</h3>
        </div>
        <button type="button" className={styles.secondaryButton} onClick={onCreateNote}>
          <Plus size={16} />
          New list
        </button>
      </div>

      <label className={styles.keepSearchField}>
        <Search size={16} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your lists"
        />
      </label>

      <div className={styles.keepSelectorStats}>
        <span>{selectedNoteIds.length} selected</span>
        <span>{pinnedNoteIds.length} pinned</span>
      </div>

      <div className={styles.keepSelectorList}>
        {filteredNotes.map((note) => {
          const isSelected = selectedNoteIdSet.has(note.id);
          const isPinned = pinnedNoteIdSet.has(note.id);
          const preview = getListPreviewText(note);

          return (
            <div
              key={note.id}
              className={clsx(
                styles.keepSelectorRow,
                isSelected && styles.keepSelectorRowSelected,
              )}
            >
              <button
                type="button"
                className={styles.keepSelectorChoice}
                onClick={() => onToggleSelection(note.id)}
              >
                <span
                  className={clsx(
                    styles.keepSelectorCheck,
                    isSelected && styles.keepSelectorCheckActive,
                  )}
                >
                  {isSelected ? <Check size={14} /> : null}
                </span>
                <span className={styles.keepSelectorCopy}>
                  <strong>{note.title || "Untitled list"}</strong>
                  <span>{preview || "No preview yet"}</span>
                </span>
              </button>

              <button
                type="button"
                className={clsx(
                  styles.keepPinButton,
                  isPinned && styles.keepPinButtonActive,
                )}
                onClick={() => onTogglePin(note.id)}
                disabled={!isSelected}
                aria-label={
                  isPinned ? `Unpin ${note.title}` : `Pin ${note.title}`
                }
              >
                <Pin size={14} />
              </button>
            </div>
          );
        })}

        {filteredNotes.length === 0 ? (
          <div className={styles.emptyDayCard}>
            <p>No lists match that search yet.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type ChecklistBranchProps = {
  items: ListItem[];
  onAddChild: (path: number[] | null) => void;
  onMove: (path: number[], direction: -1 | 1) => void;
  onRemove: (path: number[]) => void;
  onToggle: (path: number[]) => void;
  onUpdateText: (path: number[], value: string) => void;
  parentPath?: number[];
};

function ChecklistBranch({
  items,
  onAddChild,
  onMove,
  onRemove,
  onToggle,
  onUpdateText,
  parentPath = [],
}: ChecklistBranchProps) {
  return (
    <div className={styles.keepChecklistList}>
      {items.map((item, index) => {
        const path = [...parentPath, index];

        return (
          <div key={item.id} className={styles.keepChecklistNode}>
            <div className={styles.keepChecklistRow}>
              <button
                type="button"
                className={clsx(
                  styles.keepChecklistToggle,
                  item.checked && styles.keepChecklistToggleChecked,
                )}
                onClick={() => onToggle(path)}
                aria-pressed={item.checked}
              >
                {item.checked ? <Check size={15} /> : null}
              </button>

              <input
                value={item.text}
                className={clsx(
                  styles.keepChecklistInput,
                  item.checked && styles.keepChecklistInputChecked,
                )}
                onChange={(event) => onUpdateText(path, event.target.value)}
                placeholder="List item"
              />

              <div className={styles.keepChecklistActions}>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => onMove(path, -1)}
                  aria-label="Move item up"
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => onMove(path, 1)}
                  aria-label="Move item down"
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => onRemove(path)}
                  aria-label="Remove item"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {item.children.length > 0 ? (
              <ChecklistBranch
                items={item.children}
                onAddChild={onAddChild}
                onMove={onMove}
                onRemove={onRemove}
                onToggle={onToggle}
                onUpdateText={onUpdateText}
                parentPath={path}
              />
            ) : null}

            {path.length === 1 ? (
              <button
                type="button"
                className={styles.keepSubItemButton}
                onClick={() => onAddChild(path)}
              >
                <Plus size={14} />
                Add sub-item
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function KeepNotePanel({
  editorState,
  isSaving,
  onChange,
  onDelete,
  onSave,
  onTogglePin,
}: {
  editorState: KeepEditorState;
  isSaving: boolean;
  onChange: (nextState: KeepEditorState) => void;
  onDelete: () => void;
  onSave: () => void;
  onTogglePin: () => void;
}) {
  const isExistingNote = editorState.mode === "existing";
  const draft = editorState.draft;

  function updateDraft(nextDraft: KeepEditorState["draft"]) {
    onChange({
      ...editorState,
      draft: nextDraft,
    });
  }

  function switchDraftType(nextType: "checklist" | "text") {
    updateDraft({
      ...draft,
      type: nextType,
      text: nextType === "text" ? draft.text : "",
      items:
        nextType === "checklist"
          ? draft.items.length > 0
            ? draft.items
            : [
                {
                  id: crypto.randomUUID(),
                  text: "",
                  checked: false,
                  children: [],
                },
              ]
          : [],
    });
  }

  function toggleChecklistItem(path: number[]) {
    updateDraft({
      ...draft,
      items: updateListItemsAtPath(draft.items, path, (item) => ({
        ...item,
        checked: !item.checked,
      })),
    });
  }

  function updateChecklistText(path: number[], value: string) {
    updateDraft({
      ...draft,
      items: updateListItemsAtPath(draft.items, path, (item) => ({
        ...item,
        text: value,
      })),
    });
  }

  function removeChecklistItem(path: number[]) {
    updateDraft({
      ...draft,
      items: removeListItemAtPath(draft.items, path),
    });
  }

  function moveChecklistItem(path: number[], direction: -1 | 1) {
    updateDraft({
      ...draft,
      items: moveListItemAtPath(draft.items, path, direction),
    });
  }

  function addChecklistItem(path: number[] | null) {
    updateDraft({
      ...draft,
      items: appendListItemAtPath(draft.items, path),
    });
  }

  return (
    <div className={styles.keepNotePanel}>
      <div className={styles.keepNoteTop}>
        <div>
          <p className={styles.toolbarLabel}>Shared lists</p>
          <h3>{isExistingNote ? "Edit list" : "New list"}</h3>
        </div>

        <div className={styles.keepNoteTopActions}>
          {isExistingNote ? (
            <button
              type="button"
              className={clsx(
                styles.keepPinButton,
                editorState.isPinned && styles.keepPinButtonActive,
              )}
              onClick={onTogglePin}
            >
              <Pin size={14} />
              {editorState.isPinned ? "Pinned" : "Pin"}
            </button>
          ) : null}

          <div className={styles.segmentedControl}>
            {(["checklist", "text"] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={clsx(
                  styles.segmentedButton,
                  draft.type === type && styles.segmentedButtonActive,
                )}
                onClick={() => switchDraftType(type)}
              >
                {type === "checklist" ? "Checklist" : "Text note"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.keepSyncNotice}>
        These lists live in the app database, so saved changes show up on the dashboard
        right away and can be shared across devices using the same app data.
      </div>

      <label className={styles.editorField}>
        <span>Title</span>
        <input
          type="text"
          value={draft.title}
          onChange={(event) =>
            updateDraft({
              ...draft,
              title: event.target.value,
            })
          }
          placeholder="List title"
        />
      </label>

      {draft.type === "text" ? (
        <label className={styles.editorField}>
          <span>Note</span>
          <textarea
            value={draft.text}
            onChange={(event) =>
              updateDraft({
                ...draft,
                text: event.target.value,
              })
            }
            rows={12}
            placeholder="Write whatever should stay on this list."
          />
        </label>
      ) : (
        <div className={styles.keepChecklistPanel}>
          <div className={styles.keepChecklistPanelTop}>
            <span>Checklist items</span>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => addChecklistItem(null)}
            >
              <Plus size={16} />
              Add item
            </button>
          </div>

          <ChecklistBranch
            items={draft.items}
            onAddChild={addChecklistItem}
            onMove={moveChecklistItem}
            onRemove={removeChecklistItem}
            onToggle={toggleChecklistItem}
            onUpdateText={updateChecklistText}
          />
        </div>
      )}

      <div className={styles.keepEditorMeta}>
        <span>{editorState.isSelected ? "Selected on dashboard" : "Hidden from dashboard"}</span>
        <span>{editorState.isPinned ? "Pinned to the top" : "Not pinned"}</span>
      </div>

      <div className={styles.keepEditorActions}>
        {isExistingNote ? (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onDelete}
            disabled={isSaving}
          >
            <Trash2 size={16} />
            Delete list
          </button>
        ) : null}

        <button
          type="button"
          className={styles.primaryButton}
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <LoaderCircle className={styles.inlineSpinner} />
              Saving
            </>
          ) : isExistingNote ? (
            "Save changes"
          ) : (
            "Create list"
          )}
        </button>
      </div>
    </div>
  );
}
