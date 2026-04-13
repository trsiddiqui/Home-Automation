import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { cookies } from "next/headers";
import { google } from "googleapis";

import type { CalendarUser } from "@/lib/calendar/types";

const GOOGLE_SESSION_COOKIE = "home-schedule-google-session";
const GOOGLE_OAUTH_STATE_COOKIE = "home-schedule-google-state";
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
];

export type GoogleSession = {
  accessToken?: string;
  expiryDate?: number;
  refreshToken: string;
  user: CalendarUser;
};

export function isGoogleOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export async function getGoogleSession() {
  const cookieStore = await cookies();
  const sealed = cookieStore.get(GOOGLE_SESSION_COOKIE)?.value;

  if (!sealed) {
    return null;
  }

  try {
    return unsealSession(sealed);
  } catch {
    return null;
  }
}

export function createGoogleAuthorizationUrl({
  loginHint,
  origin,
  state,
}: {
  loginHint?: string;
  origin: string;
  state: string;
}) {
  const client = createOAuthClient(origin);

  return client.generateAuthUrl({
    access_type: "offline",
    include_granted_scopes: true,
    login_hint: loginHint,
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    state,
  });
}

export async function exchangeCodeForSession({
  code,
  origin,
}: {
  code: string;
  origin: string;
}) {
  const client = createOAuthClient(origin);
  const { tokens } = await client.getToken({
    code,
    redirect_uri: getGoogleCallbackUrl(origin),
  });

  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Remove the app from your Google account permissions and try again.",
    );
  }

  client.setCredentials(tokens);
  const profile = await google.oauth2({ version: "v2", auth: client }).userinfo.get();

  if (!profile.data.id || !profile.data.email) {
    throw new Error("Google did not return the account profile needed for the session.");
  }

  return {
    accessToken: tokens.access_token ?? undefined,
    expiryDate: tokens.expiry_date ?? undefined,
    refreshToken: tokens.refresh_token,
    user: {
      sub: profile.data.id,
      email: profile.data.email,
      name: profile.data.name ?? profile.data.email,
      picture: profile.data.picture ?? "",
    },
  } satisfies GoogleSession;
}

export async function verifyGoogleIdToken(idToken: string) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is missing.");
  }

  const client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID);
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new Error("The Google account email could not be verified.");
  }

  return {
    email: payload.email,
    name: payload.name ?? payload.email,
    picture: payload.picture ?? "",
    sub: payload.sub,
  } satisfies CalendarUser;
}

export function getGoogleCallbackUrl(origin: string) {
  return `${origin}/api/auth/google/callback`;
}

export function getGoogleLoginUrl(origin: string) {
  return `${origin}/api/auth/google/login`;
}

export function makeOauthState() {
  return randomBytes(24).toString("hex");
}

export function setGoogleSessionCookie(
  response: ResponseWithCookies,
  session: GoogleSession,
) {
  response.cookies.set(GOOGLE_SESSION_COOKIE, sealSession(session), {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearGoogleSessionCookie(response: ResponseWithCookies) {
  response.cookies.set(GOOGLE_SESSION_COOKIE, "", {
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function setGoogleOauthStateCookie(
  response: ResponseWithCookies,
  state: string,
) {
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearGoogleOauthStateCookie(response: ResponseWithCookies) {
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", {
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function getGoogleOauthState() {
  const cookieStore = await cookies();
  return cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value ?? null;
}

export function safeTokenEquals(left: string | null, right: string | null) {
  if (!left || !right) {
    return false;
  }

  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

type ResponseWithCookies = {
  cookies: {
    set: (...args: Parameters<Awaited<ReturnType<typeof cookies>>["set"]>) => void;
  };
};

function createOAuthClient(origin: string) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error(
      "Google OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    );
  }

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getGoogleCallbackUrl(origin),
  );
}

function getSessionKey() {
  return createHash("sha256")
    .update(
      process.env.APP_SESSION_SECRET ??
        process.env.GOOGLE_CLIENT_SECRET ??
        "home-schedule-dev-session-secret",
    )
    .digest();
}

function sealSession(session: GoogleSession) {
  const iv = randomBytes(12);
  const key = getSessionKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, encrypted].map((part) => part.toString("base64url")).join(".");
}

function unsealSession(sealed: string) {
  const [ivText, tagText, payloadText] = sealed.split(".");

  if (!ivText || !tagText || !payloadText) {
    throw new Error("Malformed Google session cookie.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getSessionKey(),
    Buffer.from(ivText, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payloadText, "base64url")),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8")) as GoogleSession;
}
