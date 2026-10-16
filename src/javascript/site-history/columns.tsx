import {
  AddCircle,
  Chip,
  CloudUpload,
  Delete,
  Edit,
  HandleMove,
  Language,
  NoCloud,
  Pill,
  Typography,
  Visibility,
} from "@jahia/moonstone";
import type { DataTableColumn } from "@jahia/moonstone/DataTable";
import type { ComponentType } from "react";
import { formatDate } from "./formatDate.ts";
import type { HistoryEntry } from "./siteHistory.gql.ts";
import styles from "./SiteHistoryApp.module.css";

type ChipColor = "default" | "accent" | "success" | "warning" | "danger";

const ACTION_CONFIG: Record<string, { icon: ComponentType; color: ChipColor }> = {
  added: { icon: AddCircle, color: "accent" },
  changed: { icon: Edit, color: "warning" },
  created: { icon: AddCircle, color: "accent" },
  deleted: { icon: Delete, color: "danger" },
  moved: { icon: HandleMove, color: "default" },
  published: { icon: CloudUpload, color: "success" },
  removed: { icon: Delete, color: "danger" },
  unpublished: { icon: NoCloud, color: "default" },
  updated: { icon: Edit, color: "warning" },
  accessed: { icon: Visibility, color: "default" },
};

const NO_NODE = "—";

export type HistoryTableRow = {
  id: string;
  date: string;
  user: string;
  action: string;
  name: string;
  property: string;
  language: string;
  path: string;
  uuid: string;
  message: string;
  nodeExists: boolean;
  systemName: string;
  propertyName: string;
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

const userDisplayName = (entry: HistoryEntry): string => {
  const { user, userKey } = entry;
  if (user) {
    const fullName = [user.firstname, user.lastname].filter(Boolean).join(" ");
    return fullName || user.displayName || user.username || userKey || "";
  }
  return userKey ?? "";
};

export const toRow = (entry: HistoryEntry, uiLanguage: string): HistoryTableRow => ({
  id: entry.id,
  date: formatDate(entry.date, uiLanguage),
  user: userDisplayName(entry),
  action: entry.action ?? "",
  name: entry.nodeNameDisplay || entry.nodeName || "",
  property: entry.propertyName ? entry.propertyNameDisplay || entry.propertyName : "",
  language: entry.language ?? "",
  path: entry.path ?? "",
  uuid: entry.uuid ?? "",
  message: entry.message ?? "",
  nodeExists: entry.nodeExists === true,
  systemName: entry.nodeName ?? "",
  propertyName: entry.propertyName ?? "",
});

const ellipsis = (text: string) => <Typography isNowrap component="span" title={text}>{text}</Typography>;

const withTechnicalName = (label: string, technicalName: string) => (
    <Typography isNowrap component="span" title={technicalName && technicalName !== label ? `${label} (${technicalName})` : label}>
        {label}
        {technicalName && technicalName !== label && (
            <Typography component="span" className={styles.secondary}> ({technicalName})</Typography>
        )}
    </Typography>
);

export const buildColumns = (t: Translate): DataTableColumn<HistoryTableRow>[] => [
  {
    key: "date",
    label: t("siteHistory.columns.date"),
    width: "160px",
  },
  {
    key: "user",
    label: t("siteHistory.columns.user"),
    width: "130px",
    render: ({ value }) => ellipsis(value as string),
  },
  {
    key: "action",
    label: t("siteHistory.columns.action"),
    width: "130px",
    render: ({ value }) => {
      const action = value as string;
      const config = ACTION_CONFIG[action];
      if (!config) {
        return action;
      }
      const Icon = config.icon;
      return <Chip label={t(`siteHistory.actions.${action}`)} icon={<Icon/>} color={config.color}/>;
    },
  },
  {
    key: "name",
    label: t("siteHistory.columns.name"),
    render: ({ data }) => (data.nodeExists ? withTechnicalName(data.name, data.systemName) : NO_NODE),
  },
  {
    key: "property",
    label: t("siteHistory.columns.property"),
    width: "200px",
    render: ({ data }) => (data.propertyName ? withTechnicalName(data.property, data.propertyName) : ""),
  },
  {
    key: "language",
    label: t("siteHistory.columns.language"),
    width: "90px",
    align: "center",
    render: ({ value }) => (value ? <Pill label={(value as string).toUpperCase()}/> : <Language/>),
  },
  {
    key: "path",
    label: t("siteHistory.columns.path"),
    render: ({ value }) => ellipsis(value as string),
  },
  {
    key: "uuid",
    label: t("siteHistory.columns.uuid"),
    width: "290px",
    render: ({ value }) => (
        <Typography component="span" variant="caption" className={styles.monospace}>{value as string}</Typography>
    ),
  },
  {
    key: "message",
    label: t("siteHistory.columns.message"),
    width: "160px",
    render: ({ value }) => ellipsis(value as string),
  },
];
