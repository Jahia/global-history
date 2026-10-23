import {
  AddCircle,
  Chip,
  CloudUpload,
  Delete,
  Edit,
  HandleMove,
  IconTextIcon,
  Language,
  NoCloud,
  Pill,
  toIconComponent,
  Typography,
  Visibility,
} from "@jahia/moonstone";
import type { DataTableColumn } from "@jahia/moonstone/DataTable";
import type { ComponentType } from "react";
import { formatDate } from "./formatDate.ts";
import { LocateLink } from "./LocateLink.tsx";
import type { HistoryEntry } from "./siteHistory.gql.ts";
import styles from "./SiteHistoryApp.module.css";

type ChipColor = "default" | "accent" | "success" | "warning" | "danger";

export const ACTION_CONFIG: Record<string, { icon: ComponentType; color: ChipColor }> = {
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
  contentType: string;
  property: string;
  language: string;
  locate: string;
  path: string;
  uuid: string;
  message: string;
  nodeExists: boolean;
  isDeleted: boolean;
  systemName: string;
  contentTypeName: string;
  contentTypeIcon: string;
  propertyName: string;
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** The column menu names a column by its menuLabel, and the header shows its label. */
export type HistoryColumn = DataTableColumn<HistoryTableRow> & { menuLabel?: string };

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
  contentType: entry.primaryNodeType?.displayName || entry.primaryNodeType?.name || "",
  property: entry.propertyName ? entry.propertyNameDisplay || entry.propertyName : "",
  language: entry.language ?? "",
  locate: entry.uuid ?? "",
  path: entry.path ?? "",
  uuid: entry.uuid ?? "",
  message: entry.message ?? "",
  nodeExists: entry.nodeExists === true,
  // The page query loads nodeExists with the Name column only, so a missing value is unknown.
  isDeleted: entry.nodeExists === false,
  systemName: entry.nodeName ?? "",
  contentTypeName: entry.primaryNodeType?.name ?? "",
  contentTypeIcon: entry.primaryNodeType?.icon ?? "",
  propertyName: entry.propertyName ?? "",
});

const caption = (text: string) => <Typography component="span" variant="caption">{text}</Typography>;

const ellipsis = (text: string) => (
    <Typography isNowrap component="span" variant="caption" title={text}>
        {text}
    </Typography>
);

const scrollFromEnd = (text: string) => (
    <Typography component="div" variant="caption" className={`${styles.scrollable} ${styles.scrollFromEnd}`} title={text}>
        <bdi dir="ltr">{text}</bdi>
    </Typography>
);

const withTechnicalName = (label: string, technicalName: string, isScrollable = false) => (
    <Typography
    isNowrap={!isScrollable}
    component={isScrollable ? "div" : "span"}
    variant="caption"
    className={isScrollable ? styles.scrollable : undefined}
    title={technicalName && technicalName !== label ? `${label} (${technicalName})` : label}
    >
        {label}
        {technicalName && technicalName !== label && (
            <Typography component="span" variant="caption" className={styles.secondary}> ({technicalName})</Typography>
        )}
    </Typography>
);

// The icon of a node type is the path of a PNG file without its extension, as the lists of jContent read it.
const withTypeIcon = (label: string, technicalName: string, icon: string) => (
    <IconTextIcon
    iconStart={icon ? toIconComponent(`${icon}.png`) : undefined}
    iconSize="small"
    typographyProps={{ variant: "caption" }}
    title={technicalName && technicalName !== label ? `${label} (${technicalName})` : label}
    >
        {label}
    </IconTextIcon>
);

const columnDefinitions = (t: Translate, language: string): HistoryColumn[] => [
  {
    key: "date",
    isSortable: true,
    label: t("siteHistory.columns.date"),
    width: "190px",
    render: ({ value }) => caption(value as string),
  },
  {
    key: "user",
    isSortable: true,
    label: t("siteHistory.columns.user"),
    width: "130px",
    render: ({ value }) => ellipsis(value as string),
  },
  {
    key: "name",
    label: t("siteHistory.columns.name"),
    width: "300px",
    render: ({ data }) => (data.nodeExists ? withTechnicalName(data.name, data.systemName, true) : caption(NO_NODE)),
  },
  {
    key: "contentType",
    label: t("siteHistory.columns.contentType"),
    width: "140px",
    render: ({ data }) => (data.contentType ? withTypeIcon(data.contentType, data.contentTypeName, data.contentTypeIcon) : ""),
  },
  {
    key: "property",
    isSortable: true,
    label: t("siteHistory.columns.property"),
    width: "140px",
    render: ({ data }) => (data.propertyName ? withTechnicalName(data.property, data.propertyName) : ""),
  },
  {
    key: "language",
    label: t("siteHistory.columns.language"),
    width: "90px",
    align: "center",
    render: ({ value }) => (value ? <Pill>{(value as string).toUpperCase()}</Pill> : <Language/>),
  },
  {
    key: "action",
    isSortable: true,
    label: t("siteHistory.columns.action"),
    width: "130px",
    render: ({ value }) => {
      const action = value as string;
      const config = ACTION_CONFIG[action];
      if (!config) {
        return caption(action);
      }
      const Icon = config.icon;
      return <Chip label={t(`siteHistory.actions.${action}`)} icon={<Icon/>} color={config.color}/>;
    },
  },
  {
    key: "locate",
    label: "",
    menuLabel: t("siteHistory.columns.locate"),
    width: "48px",
    align: "center",
    render: ({ data }) =>
      data.locate ? <LocateLink uuid={data.locate} isDeleted={data.isDeleted} language={language}/> : "",
  },
  {
    key: "path",
    isSortable: true,
    label: t("siteHistory.columns.path"),
    render: ({ value }) => scrollFromEnd(value as string),
  },
  {
    key: "uuid",
    isSortable: true,
    label: t("siteHistory.columns.uuid"),
    width: "290px",
    render: ({ value }) => (
        <Typography component="span" variant="caption" className={styles.monospace}>{value as string}</Typography>
    ),
  },
  {
    key: "message",
    isSortable: true,
    label: t("siteHistory.columns.message"),
    width: "160px",
    render: ({ value }) => ellipsis(value as string),
  },
];

export const buildColumns = (t: Translate, language: string): HistoryColumn[] =>
  columnDefinitions(t, language).map(column => ({ ...column, cellProps: { className: styles.denseCell } }));
