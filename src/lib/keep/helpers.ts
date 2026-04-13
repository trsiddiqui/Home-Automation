import type { KeepListItem, KeepNote, KeepNoteType } from "./types";

export type KeepDraft = {
  title: string;
  type: KeepNoteType;
  text: string;
  items: KeepListItem[];
};

export function cloneKeepItems(items: KeepListItem[]): KeepListItem[] {
  return items.map((item) => ({
    ...item,
    children: cloneKeepItems(item.children),
  }));
}

export function createKeepDraftFromNote(note: KeepNote): KeepDraft {
  return {
    title: note.title,
    type: note.type,
    text: note.text,
    items: cloneKeepItems(note.items),
  };
}

export function createEmptyKeepDraft(type: KeepNoteType = "checklist"): KeepDraft {
  return {
    title: "",
    type,
    text: "",
    items: type === "checklist" ? [createKeepListItem("")] : [],
  };
}

export function createKeepListItem(text = ""): KeepListItem {
  return {
    id: crypto.randomUUID(),
    text,
    checked: false,
    children: [],
  };
}

export function applyKeepDraft(note: KeepNote, draft: KeepDraft): KeepNote {
  return {
    ...note,
    title: draft.title,
    type: draft.type,
    text: draft.text,
    items: cloneKeepItems(draft.items),
  };
}

export function isKeepDraftEmpty(draft: KeepDraft) {
  if (draft.title.trim()) {
    return false;
  }

  if (draft.type === "text") {
    return draft.text.trim().length === 0;
  }

  return !hasKeepListContent(draft.items);
}

export function hasKeepListContent(items: KeepListItem[]): boolean {
  return items.some(
    (item) => item.text.trim().length > 0 || hasKeepListContent(item.children),
  );
}

export function trimKeepDraft(draft: KeepDraft): KeepDraft {
  return {
    title: draft.title.trim(),
    type: draft.type,
    text: draft.type === "text" ? draft.text.trim() : "",
    items:
      draft.type === "checklist"
        ? trimKeepListItems(draft.items).filter(
            (item) => item.text.trim().length > 0 || item.children.length > 0,
          )
        : [],
  };
}

export function trimKeepListItems(items: KeepListItem[]): KeepListItem[] {
  return items.map((item) => ({
    ...item,
    text: item.text.trim(),
    children: trimKeepListItems(item.children),
  }));
}

export function updateKeepItemsAtPath(
  items: KeepListItem[],
  path: number[],
  updater: (item: KeepListItem) => KeepListItem,
): KeepListItem[] {
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
      children: updateKeepItemsAtPath(item.children, rest, updater),
    };
  });
}

export function removeKeepItemAtPath(items: KeepListItem[], path: number[]): KeepListItem[] {
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
      children: removeKeepItemAtPath(item.children, rest),
    };
  });
}

export function moveKeepItemAtPath(
  items: KeepListItem[],
  path: number[],
  direction: -1 | 1,
): KeepListItem[] {
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
      children: moveKeepItemAtPath(item.children, rest, direction),
    };
  });
}

export function appendKeepItemAtPath(
  items: KeepListItem[],
  path: number[] | null,
): KeepListItem[] {
  const nextItem = createKeepListItem("");

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
      children: appendKeepItemAtPath(item.children, rest),
    };
  });
}
