import type { VisibilityState } from "@tanstack/react-table";
import type { ColumnIncludes } from "./siteHistory.gql.ts";

const STORAGE_KEY = "siteHistory.columns";

// TanStack reads a column that is missing from the state as visible.
export const DEFAULT_COLUMN_VISIBILITY: VisibilityState = { uuid: false, message: false };

export const isColumnVisible = (visibility: VisibilityState, key: string): boolean => visibility[key] !== false;

const isVisibilityState = (value: unknown): value is VisibilityState =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every(visible => typeof visible === "boolean");

// The browser can block the storage, as in a private window, so a failed read gives the default choice.
export const readColumnVisibility = (): VisibilityState => {
  try {
    const stored: unknown = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? "null");
    return isVisibilityState(stored) ? { ...DEFAULT_COLUMN_VISIBILITY, ...stored } : DEFAULT_COLUMN_VISIBILITY;
  } catch {
    return DEFAULT_COLUMN_VISIBILITY;
  }
};

export const writeColumnVisibility = (visibility: VisibilityState): void => {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(visibility));
  } catch {
    // The choice then lasts until the page reloads.
  }
};

export const columnIncludes = (visibility: VisibilityState): ColumnIncludes => ({
  showDate: isColumnVisible(visibility, "date"),
  showUser: isColumnVisible(visibility, "user"),
  showName: isColumnVisible(visibility, "name"),
  showProperty: isColumnVisible(visibility, "property"),
  showLanguage: isColumnVisible(visibility, "language"),
  showAction: isColumnVisible(visibility, "action"),
  showPath: isColumnVisible(visibility, "path"),
  // The Locate column resolves the node of a row by its uuid.
  showUuid: isColumnVisible(visibility, "uuid") || isColumnVisible(visibility, "locate"),
  showMessage: isColumnVisible(visibility, "message"),
});
