import { addHours } from "date-fns";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCalendarProvider } from "@/lib/calendar/provider";

const createEventSchema = z.object({
  title: z.string().trim().min(1, "A description is required."),
  description: z.string().trim().optional().default(""),
  location: z.string().trim().optional().default(""),
  start: z.iso.datetime(),
  end: z.iso.datetime().optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!from || !to) {
      return NextResponse.json(
        { error: "Both from and to are required query parameters." },
        { status: 400 },
      );
    }

    const { auth, provider } = await getCalendarProvider();
    const snapshot = await provider.getSnapshot({ start: from, end: to });

    return NextResponse.json({
      ...snapshot,
      auth,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load calendar events.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = createEventSchema.parse(payload);

    const { auth, provider } = await getCalendarProvider();

    if (auth.status !== "connected") {
      return NextResponse.json(
        { error: "Sign in to Google before creating real calendar events." },
        { status: 401 },
      );
    }

    const createdEvent = await provider.createEvent({
      title: parsed.title,
      description: parsed.description,
      location: parsed.location,
      start: parsed.start,
      end: parsed.end ?? addHours(new Date(parsed.start), 1).toISOString(),
    });

    return NextResponse.json(createdEvent, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid event payload." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to create the event.",
      },
      { status: 500 },
    );
  }
}
