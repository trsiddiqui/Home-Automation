import { NextRequest, NextResponse } from "next/server";

import {
  clearGoogleOauthStateCookie,
  exchangeCodeForSession,
  getGoogleOauthState,
  safeTokenEquals,
  setGoogleSessionCookie,
} from "@/lib/google-auth/session";

export async function GET(request: NextRequest) {
  const homeUrl = new URL("/", request.url);
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = await getGoogleOauthState();

  if (error) {
    homeUrl.searchParams.set("authError", error);
    return NextResponse.redirect(homeUrl, 303);
  }

  if (!code || !safeTokenEquals(state, storedState)) {
    homeUrl.searchParams.set("authError", "oauth_state_mismatch");
    const response = NextResponse.redirect(homeUrl, 303);
    clearGoogleOauthStateCookie(response);
    return response;
  }

  try {
    const session = await exchangeCodeForSession({
      code,
      origin: request.nextUrl.origin,
    });

    const response = NextResponse.redirect(homeUrl, 303);
    clearGoogleOauthStateCookie(response);
    setGoogleSessionCookie(response, session);

    return response;
  } catch {
    homeUrl.searchParams.set("authError", "token_exchange_failed");
    const response = NextResponse.redirect(homeUrl, 303);
    clearGoogleOauthStateCookie(response);
    return response;
  }
}
