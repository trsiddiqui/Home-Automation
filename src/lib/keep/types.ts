import type { CalendarAuthStatus, CalendarUser } from "@/lib/calendar/types";

export type KeepNoteType = "checklist" | "text";

export type KeepListItem = {
  id: string;
  text: string;
  checked: boolean;
  children: KeepListItem[];
};

export type KeepNote = {
  id: string;
  name: string;
  title: string;
  type: KeepNoteType;
  text: string;
  items: KeepListItem[];
  createTime: string;
  updateTime: string;
  hasAttachments: boolean;
  collaboratorCount: number;
};

export type KeepSnapshot = {
  source: "google" | "mock";
  notes: KeepNote[];
  auth: {
    status: CalendarAuthStatus;
    user: CalendarUser | null;
  };
  capabilities: {
    canCreate: boolean;
    canDelete: boolean;
    canUpdateExisting: boolean;
  };
};

export type CreateKeepNoteInput = {
  title: string;
  type: KeepNoteType;
  text?: string;
  items?: KeepListItem[];
};

export interface KeepProvider {
  getSnapshot(): Promise<KeepSnapshot>;
  createNote(input: CreateKeepNoteInput): Promise<KeepNote>;
}
