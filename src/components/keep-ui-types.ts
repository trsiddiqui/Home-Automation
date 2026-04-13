import type { ListDraft } from "@/lib/lists/helpers";

export type DashboardPage = "calendar" | "lists";

export type KeepEditorState = {
  mode: "create" | "existing";
  noteId: string | null;
  draft: ListDraft;
  isSelected: boolean;
  isPinned: boolean;
};
