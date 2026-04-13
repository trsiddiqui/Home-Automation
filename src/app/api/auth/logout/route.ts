import { NextResponse } from "next/server";

import { clearGoogleSessionCookie } from "@/lib/google-auth/session";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  clearGoogleSessionCookie(response);
  return response;
}
