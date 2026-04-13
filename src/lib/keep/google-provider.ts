import { google, type keep_v1 } from "googleapis";

import type {
  CreateKeepNoteInput,
  KeepListItem,
  KeepNote,
  KeepProvider,
  KeepSnapshot,
} from "./types";
import type { GoogleSession } from "@/lib/google-auth/session";

export function createGoogleKeepProvider(session: GoogleSession): KeepProvider {
  return {
    async getSnapshot(): Promise<KeepSnapshot> {
      const keep = createKeepClient(session);
      const notes: KeepNote[] = [];
      let pageToken: string | undefined;

      do {
        const response = await keep.notes.list({
          filter: "trashed = false",
          pageSize: 100,
          pageToken,
        });

        for (const entry of response.data.notes ?? []) {
          if (!entry.name) {
            continue;
          }

          notes.push(normalizeKeepNote(entry));
        }

        pageToken = response.data.nextPageToken ?? undefined;
      } while (pageToken);

      notes.sort(
        (left, right) =>
          new Date(right.updateTime).getTime() - new Date(left.updateTime).getTime(),
      );

      return {
        source: "google",
        notes,
        auth: {
          status: "connected",
          user: session.user,
        },
        capabilities: {
          canCreate: true,
          canDelete: true,
          canUpdateExisting: false,
        },
      };
    },

    async createNote(input: CreateKeepNoteInput): Promise<KeepNote> {
      const keep = createKeepClient(session);
      const response = await keep.notes.create({
        requestBody: {
          title: input.title,
          body:
            input.type === "checklist"
              ? {
                  list: {
                    listItems: serializeKeepListItems(input.items ?? []),
                  },
                }
              : {
                  text: {
                    text: input.text ?? "",
                  },
                },
        },
      });

      if (!response.data.name) {
        throw new Error("Google Keep did not return the created list.");
      }

      return normalizeKeepNote(response.data);
    },
  };
}

function createKeepClient(session: GoogleSession) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error(
      "Google credentials are missing. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    );
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  auth.setCredentials({
    access_token: session.accessToken,
    expiry_date: session.expiryDate,
    refresh_token: session.refreshToken,
  });

  return google.keep({ version: "v1", auth });
}

function normalizeKeepNote(entry: keep_v1.Schema$Note): KeepNote {
  const name = entry.name ?? `notes/${crypto.randomUUID()}`;
  const [, id = crypto.randomUUID()] = name.split("/");
  const listItems = normalizeKeepListItems(entry.body?.list?.listItems ?? []);

  return {
    id,
    name,
    title: entry.title ?? "Untitled list",
    type: entry.body?.list ? "checklist" : "text",
    text: entry.body?.text?.text ?? "",
    items: listItems,
    createTime: entry.createTime ?? new Date().toISOString(),
    updateTime: entry.updateTime ?? entry.createTime ?? new Date().toISOString(),
    hasAttachments: (entry.attachments?.length ?? 0) > 0,
    collaboratorCount: Math.max(0, (entry.permissions?.length ?? 1) - 1),
  };
}

function normalizeKeepListItems(
  items: keep_v1.Schema$ListItem[],
): KeepListItem[] {
  return items.map((item) => ({
    id: crypto.randomUUID(),
    text: item.text?.text ?? "",
    checked: Boolean(item.checked),
    children: normalizeKeepListItems(item.childListItems ?? []),
  }));
}

function serializeKeepListItems(items: KeepListItem[]): keep_v1.Schema$ListItem[] {
  return items.map((item) => ({
    checked: item.checked,
    childListItems: serializeKeepListItems(item.children),
    text: {
      text: item.text,
    },
  }));
}
