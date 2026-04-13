import { NextRequest, NextResponse } from "next/server";

import {
  createGoogleAuthorizationUrl,
  isGoogleOAuthConfigured,
  makeOauthState,
  setGoogleOauthStateCookie,
} from "@/lib/google-auth/session";

export async function GET(request: NextRequest) {
  const homeUrl = new URL("/", request.url);

  if (!isGoogleOAuthConfigured()) {
    homeUrl.searchParams.set("authError", "missing_google_config");
    return NextResponse.redirect(homeUrl, 303);
  }

  const state = makeOauthState();
  const loginHint = request.nextUrl.searchParams.get("login_hint") ?? undefined;
  const authUrl = createGoogleAuthorizationUrl({
    loginHint,
    origin: request.nextUrl.origin,
    state,
  });

  const response = NextResponse.redirect(authUrl, 303);
  setGoogleOauthStateCookie(response, state);

  return response;
}
