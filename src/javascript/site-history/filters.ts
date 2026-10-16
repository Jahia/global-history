import type { ColumnFiltersState } from "@tanstack/react-table";
import dayjs from "dayjs";
import type { HistoryFilterInput } from "./siteHistory.gql.ts";

/** Local calendar days as "YYYY-MM-DD". An empty string is an open end. */
export type DateRange = [from: string, to: string];

const isEmpty = (value: unknown): boolean =>
  value === undefined || value === "" || (Array.isArray(value) && value.every(v => !v));

export const filterValue = <T>(filters: ColumnFiltersState, id: string): T | undefined =>
  filters.find(f => f.id === id)?.value as T | undefined;

export const withColumnFilter = (filters: ColumnFiltersState, id: string, value: unknown): ColumnFiltersState => [
  ...filters.filter(f => f.id !== id),
  ...(isEmpty(value) ? [] : [{ id, value }]),
];

export const toHistoryFilter = (filters: ColumnFiltersState): HistoryFilterInput => {
  const [from, to] = filterValue<DateRange>(filters, "date") ?? ["", ""];
  return {
    actions: filterValue<string[]>(filters, "action"),
    fromTimestamp: from ? dayjs(from).valueOf() : undefined,
    beforeTimestamp: to ? dayjs(to).add(1, "day").valueOf() : undefined,
    path: filterValue<string>(filters, "path"),
  };
};
