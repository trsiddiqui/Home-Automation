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

const createListSchema = z.object({
  title: z.string().trim().max(1000).default(""),
  type: z.enum(["checklist", "text"]),
  text: z.string().max(20000).optional().default(""),
  items: z.array(listItemSchema).optional().default([]),
  pinned: z.boolean().optional().default(false),
  selected: z.boolean().optional().default(true),
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

  return "Unable to load lists right now.";
}

export async function GET() {
  try {
    const provider = getListProvider();
    const snapshot = await provider.getSnapshot();

    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: getFriendlyListError(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = createListSchema.parse(payload);
    const provider = getListProvider();

    const createdNote = await provider.createNote({
      title: parsed.title.trim(),
      type: parsed.type,
      text: parsed.text.trim(),
      items: normalizeItems(parsed.items),
      pinned: parsed.pinned,
      selected: parsed.selected,
    });

    return NextResponse.json(createdNote, { status: 201 });
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
