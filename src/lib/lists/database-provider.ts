import { getListSql } from "./db";
import { cloneListItems } from "./helpers";
import type {
  CreateListNoteInput,
  ListItem,
  ListNote,
  ListProvider,
  ListSnapshot,
  UpdateListNoteInput,
} from "./types";

type ListRow = {
  id: string;
  title: string;
  type: "checklist" | "text";
  text: string;
  createTime: string;
  updateTime: string;
  pinned: boolean;
  selected: boolean;
};

type ListItemRow = {
  checked: boolean;
  id: string;
  listId: string;
  parentItemId: string | null;
  sortOrder: number;
  text: string;
};

let schemaPromise: Promise<void> | null = null;

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const sql = getListSql();

      await sql`
        CREATE TABLE IF NOT EXISTS dashboard_lists (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL DEFAULT '',
          type TEXT NOT NULL CHECK (type IN ('checklist', 'text')),
          text_content TEXT NOT NULL DEFAULT '',
          is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
          is_selected BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS dashboard_list_items (
          id TEXT PRIMARY KEY,
          list_id TEXT NOT NULL REFERENCES dashboard_lists(id) ON DELETE CASCADE,
          parent_item_id TEXT REFERENCES dashboard_list_items(id) ON DELETE CASCADE,
          item_text TEXT NOT NULL DEFAULT '',
          checked BOOLEAN NOT NULL DEFAULT FALSE,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS dashboard_list_items_lookup_idx
        ON dashboard_list_items (list_id, parent_item_id, sort_order)
      `;
    })();
  }

  await schemaPromise;
}

function sortNotes(input: ListNote[]) {
  return [...input].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }

    return new Date(right.updateTime).getTime() - new Date(left.updateTime).getTime();
  });
}

function buildItemTree(rows: ListItemRow[], parentItemId: string | null = null): ListItem[] {
  return rows
    .filter((row) => row.parentItemId === parentItemId)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((row) => ({
      id: row.id,
      text: row.text,
      checked: row.checked,
      children: buildItemTree(rows, row.id),
    }));
}

async function getNoteRows() {
  const sql = getListSql();

  const [listRowsResult, itemRowsResult] = await Promise.all([
    sql`
      SELECT
        id,
        title,
        type,
        text_content AS text,
        created_at AS "createTime",
        updated_at AS "updateTime",
        is_pinned AS pinned,
        is_selected AS selected
      FROM dashboard_lists
    `,
    sql`
      SELECT
        id,
        list_id AS "listId",
        parent_item_id AS "parentItemId",
        item_text AS text,
        checked,
        sort_order AS "sortOrder"
      FROM dashboard_list_items
      ORDER BY list_id ASC, parent_item_id ASC NULLS FIRST, sort_order ASC, created_at ASC
    `,
  ]);

  return {
    itemRows: itemRowsResult as ListItemRow[],
    listRows: listRowsResult as ListRow[],
  };
}

function hydrateNotes(listRows: ListRow[], itemRows: ListItemRow[]) {
  return sortNotes(
    listRows.map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type,
      text: row.text,
      items: row.type === "checklist" ? buildItemTree(itemRows.filter((item) => item.listId === row.id)) : [],
      createTime: new Date(row.createTime).toISOString(),
      updateTime: new Date(row.updateTime).toISOString(),
      pinned: row.pinned,
      selected: row.selected,
    })),
  );
}

async function getNoteById(noteId: string) {
  const { itemRows, listRows } = await getNoteRows();
  const note = hydrateNotes(
    listRows.filter((row) => row.id === noteId),
    itemRows.filter((row) => row.listId === noteId),
  )[0];

  if (!note) {
    throw new Error("That list no longer exists.");
  }

  return note;
}

async function replaceListItems(listId: string, items: ListItem[]) {
  const sql = getListSql();

  await sql`
    DELETE FROM dashboard_list_items
    WHERE list_id = ${listId}
  `;

  async function insertBranch(nodes: ListItem[], parentItemId: string | null = null) {
    for (const [index, item] of nodes.entries()) {
      const itemId = item.id || crypto.randomUUID();

      await sql`
        INSERT INTO dashboard_list_items (
          id,
          list_id,
          parent_item_id,
          item_text,
          checked,
          sort_order
        )
        VALUES (
          ${itemId},
          ${listId},
          ${parentItemId},
          ${item.text},
          ${item.checked},
          ${index}
        )
      `;

      if (item.children.length > 0) {
        await insertBranch(item.children, itemId);
      }
    }
  }

  await insertBranch(cloneListItems(items));
}

export const databaseListProvider: ListProvider = {
  async getSnapshot(): Promise<ListSnapshot> {
    await ensureSchema();
    const { itemRows, listRows } = await getNoteRows();

    return {
      source: "database",
      notes: hydrateNotes(listRows, itemRows),
      capabilities: {
        canCreate: true,
        canDelete: true,
        canUpdateExisting: true,
      },
    };
  },

  async createNote(input: CreateListNoteInput): Promise<ListNote> {
    await ensureSchema();
    const sql = getListSql();
    const noteId = crypto.randomUUID();

    await sql`
      INSERT INTO dashboard_lists (
        id,
        title,
        type,
        text_content,
        is_pinned,
        is_selected
      )
      VALUES (
        ${noteId},
        ${input.title},
        ${input.type},
        ${input.type === "text" ? input.text ?? "" : ""},
        ${input.pinned ?? false},
        ${input.selected ?? true}
      )
    `;

    if (input.type === "checklist") {
      await replaceListItems(noteId, input.items ?? []);
    }

    return getNoteById(noteId);
  },

  async updateNote(noteId: string, input: UpdateListNoteInput): Promise<ListNote> {
    await ensureSchema();
    const sql = getListSql();
    const current = await getNoteById(noteId);
    const nextType = input.type ?? current.type;
    const nextItems =
      nextType === "checklist" ? cloneListItems(input.items ?? current.items) : [];

    await sql`
      UPDATE dashboard_lists
      SET
        title = ${input.title ?? current.title},
        type = ${nextType},
        text_content = ${nextType === "text" ? input.text ?? current.text : ""},
        is_pinned = ${input.pinned ?? current.pinned},
        is_selected = ${input.selected ?? current.selected},
        updated_at = NOW()
      WHERE id = ${noteId}
    `;

    await replaceListItems(noteId, nextItems);

    return getNoteById(noteId);
  },

  async deleteNote(noteId: string): Promise<void> {
    await ensureSchema();
    const sql = getListSql();

    await sql`
      DELETE FROM dashboard_lists
      WHERE id = ${noteId}
    `;
  },
};
