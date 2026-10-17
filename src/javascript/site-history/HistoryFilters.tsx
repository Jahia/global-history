import {
  Button,
  CardSelector,
  Close,
  DateTimeInput,
  Dropdown,
  EmptyCardSelector,
  Input,
  Person,
  type Temporal,
} from "@jahia/moonstone";
import type { ColumnFiltersState, VisibilityState } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { NAMESPACE } from "../i18n.ts";
import { ColumnChoice } from "./ColumnChoice.tsx";
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

export type PickedUser = Readonly<{ name: string; label: string; uuid?: string; path?: string }>;

type UserFilterProps = Readonly<{
  filters: ColumnFiltersState;
  pickedUsers: PickedUser[];
  siteKey: string;
  language: string;
  onChange: SetFilter;
  onPick: (users: PickedUser[]) => void;
}>;

const UserFilter = ({ filters, pickedUsers, siteKey, language, onChange, onPick }: UserFilterProps) => {
  const { t } = useTranslation(NAMESPACE);
  const openPicker = globalThis.CE_API?.openPicker;
  if (!openPicker) {
    return null;
  }

  const userKeys = filterValue<string[]>(filters, "user") ?? [];
  // A site user and a global user can share a user name, so one key can match several picked users.
  const users = userKeys.flatMap(name => {
    const matches = pickedUsers.filter(user => user.name === name);
    return matches.length > 0 ? matches : [{ name, label: name }];
  });

  const open = () =>
    openPicker({
      type: "user",
      site: siteKey,
      lang: language,
      isMultiple: true,
      value: users.flatMap(({ uuid, path }) => (uuid && path ? [{ uuid, path }] : [])),
      setValue: nodes => {
        onPick(
          nodes.map(node => ({
            name: node.name,
            label:
              [node.firstName?.value, node.lastName?.value].filter(Boolean).join(" ") || node.displayName || node.name,
            uuid: node.uuid,
            path: node.path,
          })),
        );
        // The picker calls setValue on DONE even when the selection did not change.
        const names = [...new Set(nodes.map(node => node.name))];
        if (names.length !== userKeys.length || names.some(name => !userKeys.includes(name))) {
          onChange("user", names);
        }
      },
    });

  if (users.length === 0) {
    return (
        <EmptyCardSelector
        id="global-history-filter-user"
        className={styles.userFilter}
        iconStart={<Person/>}
        label={t("siteHistory.filters.user")}
        data-sel-role="filter-user"
        onClick={open}
      />
    );
  }

  return (
      <CardSelector
      id="global-history-filter-user"
      className={styles.userFilter}
      thumbnail={<Person/>}
      thumbnailType="icon"
      displayName={users.map(user => user.label).join(", ")}
      systemName={users.length === 1 ? users[0].name : undefined}
      title={users.map(user => (user.label === user.name ? user.name : `${user.label} (${user.name})`)).join(", ")}
      data-sel-role="filter-user"
      cardAction={
          <Button
          variant="ghost"
          icon={<Close/>}
          aria-label={t("siteHistory.filters.clearUsers")}
          data-sel-role="filter-user-clear"
          onClick={event => {
            // The action sits inside the card, and a click that reaches the card opens the picker.
            event.stopPropagation();
            onChange("user", []);
          }}
        />
      }
      onClick={open}
    />
  );
};

type ActionFilterProps = Readonly<{ filters: ColumnFiltersState; onChange: SetFilter }>;

const ActionFilter = ({ filters, onChange }: ActionFilterProps) => {
  const { t } = useTranslation(NAMESPACE);
  const actions = filterValue<string[]>(filters, "action") ?? [];
  const actionData = useMemo(
    () => Object.keys(ACTION_CONFIG).map(action => ({ label: t(`siteHistory.actions.${action}`), value: action })),
    [t],
  );

  const toggleAction = (action: string) =>
    onChange("action", actions.includes(action) ? actions.filter(a => a !== action) : [...actions, action]);

  return (
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
  );
};

type DateRangeFilterProps = Readonly<{ filters: ColumnFiltersState; locale: string; onChange: SetFilter }>;

const DateRangeFilter = ({ filters, locale, onChange }: DateRangeFilterProps) => {
  const { t } = useTranslation(NAMESPACE);
  const [from, to] = filterValue<DateRange>(filters, "date") ?? ["", ""];
  const calendarLabels = {
    todayButton: t("siteHistory.filters.today"),
    nextMonth: t("siteHistory.filters.nextMonth"),
    previousMonth: t("siteHistory.filters.previousMonth"),
  };

  return (
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
  columns: ReadonlyArray<{ key: string; label: string }>;
  columnVisibility: VisibilityState;
  filters: ColumnFiltersState;
  pickedUsers: PickedUser[];
  siteKey: string;
  sitePath: string;
  language: string;
  locale: string;
  onChange: SetFilter;
  onPickUsers: (users: PickedUser[]) => void;
  onClear: () => void;
  onColumnVisibilityChange: (visibility: VisibilityState) => void;
}>;

export const HistoryFilters = ({
  columns,
  columnVisibility,
  filters,
  pickedUsers,
  siteKey,
  sitePath,
  language,
  locale,
  onChange,
  onPickUsers,
  onClear,
  onColumnVisibilityChange,
}: HistoryFiltersProps) => (
    <div className={styles.filters} data-sel-role="site-history-filters">
        <DateRangeFilter filters={filters} locale={locale} onChange={onChange}/>
        <UserFilter
        filters={filters}
        pickedUsers={pickedUsers}
        siteKey={siteKey}
        language={language}
        onChange={onChange}
        onPick={onPickUsers}
      />
        <PathFilter filters={filters} sitePath={sitePath} onChange={onChange}/>
        <ActionFilter filters={filters} onChange={onChange}/>
        <ClearFilters filters={filters} onClear={onClear}/>
        <ColumnChoice columns={columns} visibility={columnVisibility} onChange={onColumnVisibilityChange}/>
    </div>
);
