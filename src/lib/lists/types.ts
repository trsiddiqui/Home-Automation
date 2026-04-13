export type ListNoteType = "checklist" | "text";

export type ListItem = {
  id: string;
  text: string;
  checked: boolean;
  children: ListItem[];
};

export type ListNote = {
  id: string;
  title: string;
  type: ListNoteType;
  text: string;
  items: ListItem[];
  createTime: string;
  updateTime: string;
  pinned: boolean;
  selected: boolean;
};

export type ListSnapshot = {
  source: "database" | "mock";
  notes: ListNote[];
  capabilities: {
    canCreate: boolean;
    canDelete: boolean;
    canUpdateExisting: boolean;
  };
};

export type CreateListNoteInput = {
  title: string;
  type: ListNoteType;
  text?: string;
  items?: ListItem[];
  pinned?: boolean;
  selected?: boolean;
};

export type UpdateListNoteInput = Partial<CreateListNoteInput>;

export interface ListProvider {
  getSnapshot(): Promise<ListSnapshot>;
  createNote(input: CreateListNoteInput): Promise<ListNote>;
  updateNote(noteId: string, input: UpdateListNoteInput): Promise<ListNote>;
  deleteNote(noteId: string): Promise<void>;
}
