import { cloneKeepItems, createKeepListItem } from "./helpers";
import type {
  CreateKeepNoteInput,
  KeepNote,
  KeepProvider,
  KeepSnapshot,
} from "./types";

const now = new Date().toISOString();

let notes: KeepNote[] = [
  {
    id: "groceries",
    name: "notes/groceries",
    title: "Groceries",
    type: "checklist",
    text: "",
    items: [
      { ...createKeepListItem("Milk"), checked: false },
      { ...createKeepListItem("Bananas"), checked: false },
      { ...createKeepListItem("Coffee beans"), checked: true },
    ],
    createTime: now,
    updateTime: now,
    hasAttachments: false,
    collaboratorCount: 1,
  },
  {
    id: "weekend",
    name: "notes/weekend",
    title: "Weekend errands",
    type: "checklist",
    text: "",
    items: [
      { ...createKeepListItem("Library books"), checked: false },
      { ...createKeepListItem("Hardware store"), checked: false },
      { ...createKeepListItem("Call mom"), checked: true },
    ],
    createTime: now,
    updateTime: now,
    hasAttachments: false,
    collaboratorCount: 0,
  },
  {
    id: "packing",
    name: "notes/packing",
    title: "Trip packing",
    type: "text",
    text: "Passports\nChargers\nSnacks for the kids\nPrinted itinerary",
    items: [],
    createTime: now,
    updateTime: now,
    hasAttachments: false,
    collaboratorCount: 0,
  },
];

export const mockKeepProvider: KeepProvider = {
  async getSnapshot(): Promise<KeepSnapshot> {
    return {
      source: "mock",
      notes,
      auth: {
        status: "missing_configuration",
        user: null,
      },
      capabilities: {
        canCreate: false,
        canDelete: false,
        canUpdateExisting: false,
      },
    };
  },

  async createNote(input: CreateKeepNoteInput): Promise<KeepNote> {
    const createdAt = new Date().toISOString();
    const note: KeepNote = {
      id: crypto.randomUUID(),
      name: `notes/${crypto.randomUUID()}`,
      title: input.title,
      type: input.type,
      text: input.type === "text" ? input.text ?? "" : "",
      items:
        input.type === "checklist"
          ? cloneKeepItems(input.items ?? [])
          : [],
      createTime: createdAt,
      updateTime: createdAt,
      hasAttachments: false,
      collaboratorCount: 0,
    };

    notes = [note, ...notes];
    return note;
  },
};
