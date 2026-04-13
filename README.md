# Home Schedule Hub

A family-friendly calendar dashboard designed for three screen targets:

- `mobile`: compact stacked layout
- `web`: balanced desktop layout
- `kiosk`: large-touch layout for a 24-27 inch monitor

The app reads from every readable calendar by default, writes only to the configured writable calendar, and falls back to demo data until you sign in with Google. Shared lists are app-owned and use a Postgres database.

## Run It

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Google Calendar Setup

1. Copy `.env.example` to `.env.local`.
2. In Google Cloud Console, create or edit an OAuth 2.0 client of type `Web application`.
3. Add this Authorized JavaScript origin for local development:
   `http://localhost:3000`
4. Add this Authorized redirect URI:
   `http://localhost:3000/api/auth/google/callback`
5. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` into `.env.local`.
6. Optionally add `APP_SESSION_SECRET` to encrypt the Google session cookie with your own secret instead of the development fallback.
7. Set `GOOGLE_WRITE_CALENDAR_ID` to the calendar that should receive new events. Leave it as `primary` if you want writes to land on your main calendar.
8. Optionally set `GOOGLE_READ_CALENDAR_IDS` as a comma-separated list if you do not want to read every shared calendar the account can see.
9. Restart `npm run dev`.

The app now handles Google sign-in interactively and stores the calendar session itself. You no longer paste a refresh token into `.env.local`.

## Shared Lists Storage

1. Provision a Neon Postgres database through Vercel Storage or use an existing Neon database.
2. Add the connection string to `.env.local` as `DATABASE_URL`.
3. Restart `npm run dev`.

If `DATABASE_URL` is missing, the Lists page falls back to demo data so the UI still works.

## Current Feature Slice

- Daily, weekly, and monthly calendar views
- Occupancy coloring from green to yellow to orange
- Mobile, desktop, and kiosk-specific layout switching based on viewport and pointer type
- Simple scheduling form that posts to an API route and writes only to the configured writable calendar
- Shared-calendar legend showing which sources are read-only versus writable
- Shared lists page with selectable, pinnable text notes and checklists
