import { databaseListProvider } from "./database-provider";
import { hasListsDatabase } from "./db";
import { mockListProvider } from "./mock-provider";

export function getListProvider() {
  return hasListsDatabase() ? databaseListProvider : mockListProvider;
}
