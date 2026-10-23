import {
  AddPerson,
  Button,
  Close,
  DateTimeInput,
  Dropdown,
  FolderOpen,
  Input,
  type Temporal,
} from "@jahia/moonstone";
import type { ColumnFiltersState, VisibilityState } from "@tanstack/react-table";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { NAMESPACE } from "../i18n.ts";
import { ColumnChoice } from "./ColumnChoice.tsx";
import { ACTION_CONFIG } from "./columns.tsx";
import { filterValue, parseUserKeys, type DateRange } from "./filters.ts";
import styles from "./SiteHistoryApp.module.css";

type SetFilter = (id: string, value: unknown) => void;

// The moonstone typings drop the null that DateTimeInput emits when the user clears the field.
const toDay = (value: Temporal.PlainDate | null): string => value?.toString() ?? "";

type PickerButtonProps = Readonly<{ icon: ReactElement; label: string; role: string; onClick: () => void }>;

const PickerButton = ({ icon, label, role, onClick }: PickerButtonProps) => (
    <Button
    variant="ghost"
    size="small"
    icon={icon}
    aria-label={label}
    title={label}
    data-sel-role={role}
    onClick={onClick}
  />
);

type PathFilterProps = Readonly<{
  filters: ColumnFiltersState;
  siteKey: string;
  sitePath: string;
  language: string;
  onChange: SetFilter;
}>;

const PathFilter = ({ filters, siteKey, sitePath, language, onChange }: PathFilterProps) => {
  const { t } = useTranslation(NAMESPACE);
  const openPicker = globalThis.CE_API?.openPicker;
  const path = filterValue<string>(filters, "path") ?? "";
  const [draft, setDraft] = useState(path);
  useEffect(() => setDraft(path), [path]);

  const commit = (value: string) => {
    if (value.trim() !== path) {
      onChange("path", value.trim());
    }
  };

  const open = () =>
    openPicker?.({
      type: "editorial",
      site: siteKey,
      lang: language,
      setValue: ([node]) => node && commit(node.path),
    });

  return (
      <Input
      className={styles.pathFilter}
      value={draft}
      placeholder={t("siteHistory.filters.path", { example: `${sitePath}/home`, interpolation: { escapeValue: false } })}
      aria-label={t("siteHistory.columns.path")}
      data-sel-role="filter-path"
      postfixComponents={
        openPicker && [
            <PickerButton
            key="picker"
            icon={<FolderOpen/>}
            label={t("siteHistory.filters.pickPath")}
            role="filter-path-picker"
            onClick={open}
          />,
        ]
      }
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

export type PickedUser = Readonly<{ name: string; uuid: string; path: string }>;

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
  const userKeys = filterValue<string[]>(filters, "user") ?? [];
  // The effect depends on the text, because a missing filter gives a new empty array on every render.
  const text = userKeys.join(", ");
  const [draft, setDraft] = useState(text);
  useEffect(() => setDraft(text), [text]);

  const commit = (keys: string[]) => {
    setDraft(keys.join(", "));
    if (keys.join(", ") !== text) {
      onChange("user", keys);
    }
  };

  // A typed key has no node, so the picker preselects only the users that it returned before.
  const preselected = pickedUsers.filter(user => userKeys.includes(user.name));

  const open = () =>
    openPicker?.({
      type: "user",
      site: siteKey,
      lang: language,
      isMultiple: true,
      value: preselected.map(({ uuid, path }) => ({ uuid, path })),
      setValue: nodes => {
        onPick(nodes.map(({ name, uuid, path }) => ({ name, uuid, path })));
        // The picked users replace the preselected users, so a user unselected in the picker leaves the list.
        const typed = userKeys.filter(key => !preselected.some(user => user.name === key));
        commit([...new Set([...typed, ...nodes.map(node => node.name)])]);
      },
    });

  return (
      <Input
      className={styles.userFilter}
      value={draft}
      placeholder={t("siteHistory.filters.user")}
      aria-label={t("siteHistory.columns.user")}
      data-sel-role="filter-user"
      postfixComponents={
        openPicker && [
            <PickerButton
            key="picker"
            icon={<AddPerson/>}
            label={t("siteHistory.filters.pickUsers")}
            role="filter-user-picker"
            onClick={open}
          />,
        ]
      }
      onChange={event => setDraft(event.target.value)}
      onKeyUp={event => {
        if (event.key === "Enter") {
          commit(parseUserKeys(draft));
        }
      }}
      onBlur={() => commit(parseUserKeys(draft))}
      onClear={() => commit([])}
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
        <PathFilter filters={filters} siteKey={siteKey} sitePath={sitePath} language={language} onChange={onChange}/>
        <ActionFilter filters={filters} onChange={onChange}/>
        <ClearFilters filters={filters} onClear={onClear}/>
        <ColumnChoice columns={columns} visibility={columnVisibility} onChange={onColumnVisibilityChange}/>
    </div>
);
