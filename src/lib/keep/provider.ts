import { getGoogleSession, isGoogleOAuthConfigured } from "@/lib/google-auth/session";

import { createGoogleKeepProvider } from "./google-provider";
import { mockKeepProvider } from "./mock-provider";

export async function getKeepProvider() {
  const session = await getGoogleSession();

  if (session) {
    return {
      provider: createGoogleKeepProvider(session),
      auth: {
        status: "connected" as const,
        user: session.user,
      },
    };
  }

  return {
    provider: mockKeepProvider,
    auth: {
      status: isGoogleOAuthConfigured()
        ? ("signed_out" as const)
        : ("missing_configuration" as const),
      user: null,
    },
  };
}
