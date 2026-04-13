import { getGoogleSession, isGoogleOAuthConfigured } from "@/lib/google-auth/session";

import { createGoogleCalendarProvider } from "./google-provider";
import { mockCalendarProvider } from "./mock-provider";

export async function getCalendarProvider() {
  const session = await getGoogleSession();

  if (session) {
    return {
      provider: createGoogleCalendarProvider(session),
      auth: {
        status: "connected" as const,
        user: session.user,
      },
    };
  }

  return {
    provider: mockCalendarProvider,
    auth: {
      status: isGoogleOAuthConfigured()
        ? ("signed_out" as const)
        : ("missing_configuration" as const),
      user: null,
    },
  };
}
