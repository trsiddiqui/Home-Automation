import { NextResponse } from "next/server";
import { z } from "zod";

import { getCalendarProvider } from "@/lib/calendar/provider";

const updateEventSchema = z.object({
  calendarId: z.string().trim().min(1, "A calendar is required."),
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  location: z.string().trim().optional(),
  start: z.iso.datetime().optional(),
  end: z.iso.datetime().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  try {
    const payload = await request.json();
    const parsed = updateEventSchema.parse(payload);
    const { auth, provider } = await getCalendarProvider();

    if (auth.status !== "connected") {
      return NextResponse.json(
        { error: "Sign in to Google before editing real calendar events." },
        { status: 401 },
      );
    }

    const { eventId } = await context.params;

    const updatedEvent = await provider.updateEvent({
      eventId,
      calendarId: parsed.calendarId,
      title: parsed.title,
      description: parsed.description,
      location: parsed.location,
      start: parsed.start,
      end: parsed.end,
    });

    return NextResponse.json(updatedEvent);
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
          error instanceof Error ? error.message : "Unable to update the event.",
      },
      { status: 500 },
    );
  }
}
