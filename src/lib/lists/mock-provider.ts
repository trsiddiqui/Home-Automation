import { cloneListItems, createListItem } from "./helpers";
import type {
  CreateListNoteInput,
  ListNote,
  ListProvider,
  ListSnapshot,
  UpdateListNoteInput,
} from "./types";

const now = new Date().toISOString();

let notes: ListNote[] = [
  {
    id: "groceries",
    title: "Groceries",
    type: "checklist",
    text: "",
    items: [
      { ...createListItem("Milk"), checked: false },
      { ...createListItem("Bananas"), checked: false },
      { ...createListItem("Coffee beans"), checked: true },
    ],
    createTime: now,
    updateTime: now,
    pinned: true,
    selected: true,
  },
  {
    id: "weekend",
    title: "Weekend errands",
    type: "checklist",
    text: "",
    items: [
      { ...createListItem("Library books"), checked: false },
      { ...createListItem("Hardware store"), checked: false },
      { ...createListItem("Call mom"), checked: true },
    ],
    createTime: now,
    updateTime: now,
    pinned: false,
    selected: true,
  },
  {
    id: "packing",
    title: "Trip packing",
    type: "text",
    text: "Passports\nChargers\nSnacks for the kids\nPrinted itinerary",
    items: [],
    createTime: now,
    updateTime: now,
    pinned: false,
    selected: false,
  },
];

function sortNotes(input: ListNote[]) {
  return [...input].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }

    return new Date(right.updateTime).getTime() - new Date(left.updateTime).getTime();
  });
}

export const mockListProvider: ListProvider = {
  async getSnapshot(): Promise<ListSnapshot> {
    return {
      source: "mock",
      notes: sortNotes(notes),
      capabilities: {
        canCreate: true,
        canDelete: true,
        canUpdateExisting: true,
      },
    };
  },

  async createNote(input: CreateListNoteInput): Promise<ListNote> {
    const createdAt = new Date().toISOString();
    const note: ListNote = {
      id: crypto.randomUUID(),
      title: input.title,
      type: input.type,
      text: input.type === "text" ? input.text ?? "" : "",
      items: input.type === "checklist" ? cloneListItems(input.items ?? []) : [],
      createTime: createdAt,
      updateTime: createdAt,
      pinned: input.pinned ?? false,
      selected: input.selected ?? true,
    };

    notes = sortNotes([note, ...notes]);
    return note;
  },

  async updateNote(noteId: string, input: UpdateListNoteInput): Promise<ListNote> {
    const existing = notes.find((note) => note.id === noteId);

    if (!existing) {
      throw new Error("That list no longer exists.");
    }

    const nextType = input.type ?? existing.type;
    const nextNote: ListNote = {
      ...existing,
      title: input.title ?? existing.title,
      type: nextType,
      text: nextType === "text" ? input.text ?? existing.text : "",
      items:
        nextType === "checklist"
          ? cloneListItems(input.items ?? existing.items)
          : [],
      pinned: input.pinned ?? existing.pinned,
      selected: input.selected ?? existing.selected,
      updateTime: new Date().toISOString(),
    };

    notes = sortNotes(notes.map((note) => (note.id === noteId ? nextNote : note)));
    return nextNote;
  },

  async deleteNote(noteId: string): Promise<void> {
    notes = notes.filter((note) => note.id !== noteId);
  },
};
