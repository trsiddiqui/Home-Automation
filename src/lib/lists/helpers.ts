import type { ListItem, ListNote, ListNoteType } from "./types";

export type ListDraft = {
  title: string;
  type: ListNoteType;
  text: string;
  items: ListItem[];
};

export function cloneListItems(items: ListItem[]): ListItem[] {
  return items.map((item) => ({
    ...item,
    children: cloneListItems(item.children),
  }));
}

export function createListDraftFromNote(note: ListNote): ListDraft {
  return {
    title: note.title,
    type: note.type,
    text: note.text,
    items: cloneListItems(note.items),
  };
}

export function createEmptyListDraft(type: ListNoteType = "checklist"): ListDraft {
  return {
    title: "",
    type,
    text: "",
    items: type === "checklist" ? [createListItem("")] : [],
  };
}

export function createListItem(text = ""): ListItem {
  return {
    id: crypto.randomUUID(),
    text,
    checked: false,
    children: [],
  };
}

export function applyListDraft(note: ListNote, draft: ListDraft): ListNote {
  return {
    ...note,
    title: draft.title,
    type: draft.type,
    text: draft.text,
    items: cloneListItems(draft.items),
  };
}

export function isListDraftEmpty(draft: ListDraft) {
  if (draft.title.trim()) {
    return false;
  }

  if (draft.type === "text") {
    return draft.text.trim().length === 0;
  }

  return !hasListContent(draft.items);
}

export function hasListContent(items: ListItem[]): boolean {
  return items.some(
    (item) => item.text.trim().length > 0 || hasListContent(item.children),
  );
}

export function trimListDraft(draft: ListDraft): ListDraft {
  return {
    title: draft.title.trim(),
    type: draft.type,
    text: draft.type === "text" ? draft.text.trim() : "",
    items:
      draft.type === "checklist"
        ? trimListItems(draft.items).filter(
            (item) => item.text.trim().length > 0 || item.children.length > 0,
          )
        : [],
  };
}

export function trimListItems(items: ListItem[]): ListItem[] {
  return items.map((item) => ({
    ...item,
    text: item.text.trim(),
    children: trimListItems(item.children),
  }));
}

export function updateListItemsAtPath(
  items: ListItem[],
  path: number[],
  updater: (item: ListItem) => ListItem,
): ListItem[] {
  if (path.length === 0) {
    return items;
  }

  const [index, ...rest] = path;
  return items.map((item, itemIndex) => {
    if (itemIndex !== index) {
      return item;
    }

    if (rest.length === 0) {
      return updater(item);
    }

    return {
      ...item,
      children: updateListItemsAtPath(item.children, rest, updater),
    };
  });
}

export function removeListItemAtPath(items: ListItem[], path: number[]): ListItem[] {
  if (path.length === 0) {
    return items;
  }

  const [index, ...rest] = path;

  if (rest.length === 0) {
    return items.filter((_, itemIndex) => itemIndex !== index);
  }

  return items.map((item, itemIndex) => {
    if (itemIndex !== index) {
      return item;
    }

    return {
      ...item,
      children: removeListItemAtPath(item.children, rest),
    };
  });
}

export function moveListItemAtPath(
  items: ListItem[],
  path: number[],
  direction: -1 | 1,
): ListItem[] {
  if (path.length === 0) {
    return items;
  }

  const [index, ...rest] = path;

  if (rest.length === 0) {
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= items.length) {
      return items;
    }

    const nextItems = [...items];
    const [item] = nextItems.splice(index, 1);
    nextItems.splice(nextIndex, 0, item);
    return nextItems;
  }

  return items.map((item, itemIndex) => {
    if (itemIndex !== index) {
      return item;
    }

    return {
      ...item,
      children: moveListItemAtPath(item.children, rest, direction),
    };
  });
}

export function appendListItemAtPath(
  items: ListItem[],
  path: number[] | null,
): ListItem[] {
  const nextItem = createListItem("");

  if (!path || path.length === 0) {
    return [...items, nextItem];
  }

  const [index, ...rest] = path;

  return items.map((item, itemIndex) => {
    if (itemIndex !== index) {
      return item;
    }

    if (rest.length === 0) {
      return {
        ...item,
        children: [...item.children, nextItem],
      };
    }

    return {
      ...item,
      children: appendListItemAtPath(item.children, rest),
    };
  });
}
