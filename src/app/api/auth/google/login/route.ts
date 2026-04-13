import { NextRequest, NextResponse } from "next/server";

import {
  isGoogleOAuthConfigured,
  verifyGoogleIdToken,
} from "@/lib/google-auth/session";

export async function POST(request: NextRequest) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      { error: "Google OAuth is not configured yet." },
      { status: 500 },
    );
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Invalid origin for Google login." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as { credential?: string };
  const credential = body.credential;

  if (!credential) {
    return NextResponse.json(
      { error: "The Google credential payload is missing." },
      { status: 400 },
    );
  }

  try {
    const user = await verifyGoogleIdToken(credential);
    const redirectUrl = new URL("/api/auth/google/start", request.url);
    redirectUrl.searchParams.set("login_hint", user.email);

    return NextResponse.json({ redirectTo: redirectUrl.toString() });
  } catch {
    return NextResponse.json(
      { error: "Google sign-in could not be verified." },
      { status: 401 },
    );
  }
}
