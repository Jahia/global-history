import type { SortingState } from "@tanstack/react-table";
import type { HistorySortField, HistorySortInput } from "./siteHistory.gql.ts";

export const DEFAULT_SORTING: SortingState = [{ id: "date", desc: true }];

// The key of a sortable column is its GraphQL sort field in lower case.
export const toHistorySort = ([sort]: SortingState): HistorySortInput => ({
  field: sort.id.toUpperCase() as HistorySortField,
  direction: sort.desc ? "DESC" : "ASC",
});
