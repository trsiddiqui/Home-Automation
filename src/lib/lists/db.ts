import { neon } from "@neondatabase/serverless";

let sqlClient: ReturnType<typeof neon> | null = null;

export function hasListsDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export function getListSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not configured. Connect a Neon database in Vercel storage and add the connection string locally.",
    );
  }

  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }

  return sqlClient;
}
