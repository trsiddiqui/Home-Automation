import { NextResponse } from "next/server";
import { z } from "zod";

import { getListProvider } from "@/lib/lists/provider";
import type { ListItem } from "@/lib/lists/types";

type IncomingListItem = {
  id?: string;
  text: string;
  checked: boolean;
  children: IncomingListItem[];
};

const listItemSchema: z.ZodType<IncomingListItem> = z.object({
  id: z.string().optional(),
  text: z.string().max(2000).default(""),
  checked: z.boolean().default(false),
  children: z.array(z.lazy(() => listItemSchema)).default([]),
});

const updateListSchema = z.object({
  title: z.string().trim().max(1000).optional(),
  type: z.enum(["checklist", "text"]).optional(),
  text: z.string().max(20000).optional(),
  items: z.array(listItemSchema).optional(),
  pinned: z.boolean().optional(),
  selected: z.boolean().optional(),
});

function normalizeItems(items: IncomingListItem[]): ListItem[] {
  return items.map((item) => ({
    id: item.id ?? crypto.randomUUID(),
    text: item.text.trim(),
    checked: item.checked,
    children: normalizeItems(item.children),
  }));
}

function getFriendlyListError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to update that list right now.";
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  try {
    const { listId } = await context.params;
    const payload = await request.json();
    const parsed = updateListSchema.parse(payload);
    const provider = getListProvider();

    const note = await provider.updateNote(listId, {
      ...parsed,
      title: parsed.title?.trim(),
      text: parsed.text?.trim(),
      items: parsed.items ? normalizeItems(parsed.items) : undefined,
    });

    return NextResponse.json(note);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid list payload." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: getFriendlyListError(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  try {
    const { listId } = await context.params;
    const provider = getListProvider();

    await provider.deleteNote(listId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: getFriendlyListError(error) },
      { status: 500 },
    );
  }
}
