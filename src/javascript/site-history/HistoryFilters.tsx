import { Button, Close, DateTimeInput, Dropdown, Input, type Temporal } from "@jahia/moonstone";
import type { ColumnFiltersState } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { NAMESPACE } from "../i18n.ts";
import { ACTION_CONFIG } from "./columns.tsx";
import { filterValue, type DateRange } from "./filters.ts";
import styles from "./SiteHistoryApp.module.css";

type SetFilter = (id: string, value: unknown) => void;

// The moonstone typings drop the null that DateTimeInput emits when the user clears the field.
const toDay = (value: Temporal.PlainDate | null): string => value?.toString() ?? "";

type PathFilterProps = Readonly<{ filters: ColumnFiltersState; sitePath: string; onChange: SetFilter }>;

const PathFilter = ({ filters, sitePath, onChange }: PathFilterProps) => {
  const { t } = useTranslation(NAMESPACE);
  const path = filterValue<string>(filters, "path") ?? "";
  const [draft, setDraft] = useState(path);
  useEffect(() => setDraft(path), [path]);

  const commit = (value: string) => {
    if (value.trim() !== path) {
      onChange("path", value.trim());
    }
  };

  return (
      <Input
      className={styles.pathFilter}
      value={draft}
      placeholder={t("siteHistory.filters.path", { example: `${sitePath}/home`, interpolation: { escapeValue: false } })}
      aria-label={t("siteHistory.columns.path")}
      data-sel-role="filter-path"
      onChange={event => setDraft(event.target.value)}
      onKeyUp={event => {
        if (event.key === "Enter") {
          commit(draft);
        }
      }}
      onBlur={() => commit(draft)}
      onClear={() => {
        setDraft("");
        commit("");
      }}
    />
  );
};

type FilterControlsProps = Readonly<{ filters: ColumnFiltersState; locale: string; onChange: SetFilter }>;

const FilterControls = ({ filters, locale, onChange }: FilterControlsProps) => {
  const { t } = useTranslation(NAMESPACE);
  const actions = filterValue<string[]>(filters, "action") ?? [];
  const [from, to] = filterValue<DateRange>(filters, "date") ?? ["", ""];
  const actionData = useMemo(
    () => Object.keys(ACTION_CONFIG).map(action => ({ label: t(`siteHistory.actions.${action}`), value: action })),
    [t],
  );
  const calendarLabels = {
    todayButton: t("siteHistory.filters.today"),
    nextMonth: t("siteHistory.filters.nextMonth"),
    previousMonth: t("siteHistory.filters.previousMonth"),
  };

  const toggleAction = (action: string) =>
    onChange("action", actions.includes(action) ? actions.filter(a => a !== action) : [...actions, action]);

  return (
      <>
          <Dropdown
        className={styles.actionFilter}
        variant="outlined"
        size="small"
        hasSearch={false}
        placeholder={t("siteHistory.filters.action")}
        values={actions}
        data={actionData}
        data-sel-role="filter-action"
        onChange={(_event, { value }) => value && toggleAction(value)}
        onClear={() => onChange("action", [])}
      />
          <div className={styles.dateRange}>
              <DateTimeInput
          type="date"
          variant="outlined"
          locale={locale}
          i18n={calendarLabels}
          value={from}
          maxDate={to}
          placeholder={t("siteHistory.filters.dateFrom")}
          aria-label={t("siteHistory.filters.dateFrom")}
          data-sel-role="filter-date-from"
          onChange={(_event, value) => onChange("date", [toDay(value), to])}
        />
              <DateTimeInput
          type="date"
          variant="outlined"
          locale={locale}
          i18n={calendarLabels}
          value={to}
          minDate={from}
          placeholder={t("siteHistory.filters.dateTo")}
          aria-label={t("siteHistory.filters.dateTo")}
          data-sel-role="filter-date-to"
          onChange={(_event, value) => onChange("date", [from, toDay(value)])}
        />
          </div>
      </>
  );
};

type ClearFiltersProps = Readonly<{ filters: ColumnFiltersState; onClear: () => void }>;

const ClearFilters = ({ filters, onClear }: ClearFiltersProps) => {
  const { t } = useTranslation(NAMESPACE);
  return (
      <Button
      className={styles.clearFilters}
      variant="ghost"
      icon={<Close/>}
      label={t("siteHistory.filters.clear")}
      isDisabled={filters.length === 0}
      data-sel-role="filter-clear"
      onClick={onClear}
    />
  );
};

type HistoryFiltersProps = Readonly<{
  filters: ColumnFiltersState;
  sitePath: string;
  locale: string;
  onChange: SetFilter;
  onClear: () => void;
}>;

export const HistoryFilters = ({ filters, sitePath, locale, onChange, onClear }: HistoryFiltersProps) => (
    <div className={styles.filters} data-sel-role="site-history-filters">
        <PathFilter filters={filters} sitePath={sitePath} onChange={onChange}/>
        <FilterControls filters={filters} locale={locale} onChange={onChange}/>
        <ClearFilters filters={filters} onClear={onClear}/>
    </div>
);
