import { gql } from "@apollo/client";

export type HistoryUser = {
  username: string | null;
  firstname: string | null;
  lastname: string | null;
  displayName: string | null;
};

// The page query skips the fields of a hidden column, so every field but id can be missing.
export type HistoryEntry = {
  id: string;
  date?: string | null;
  uuid?: string | null;
  path?: string | null;
  action?: string | null;
  propertyName?: string | null;
  propertyNameDisplay?: string | null;
  userKey?: string | null;
  message?: string | null;
  language?: string | null;
  nodeExists?: boolean | null;
  nodeName?: string | null;
  nodeNameDisplay?: string | null;
  user?: HistoryUser | null;
};

export type SiteHistoryData = {
  jcr: {
    nodeByPath: {
      uuid: string;
      workspace: string;
      displayName: string | null;
      globalHistory: {
        totalCount: number;
        entries: (HistoryEntry | null)[] | null;
      } | null;
    } | null;
  };
};

export type HistoryFilterInput = {
  actions?: string[];
  userKeys?: string[];
  fromTimestamp?: number;
  beforeTimestamp?: number;
  path?: string;
};

export type HistorySortField = "DATE" | "USER" | "ACTION" | "PATH" | "PROPERTY" | "UUID" | "MESSAGE";

export type HistorySortInput = {
  field: HistorySortField;
  direction: "ASC" | "DESC";
};

export type ColumnIncludes = {
  showDate: boolean;
  showUser: boolean;
  showName: boolean;
  showProperty: boolean;
  showLanguage: boolean;
  showAction: boolean;
  showPath: boolean;
  showUuid: boolean;
  showMessage: boolean;
};

export type SiteHistoryVariables = ColumnIncludes & {
  path: string;
  uiLanguage: string;
  offset: number;
  limit: number;
  filter: HistoryFilterInput;
  sort: HistorySortInput;
};

export const SITE_HISTORY_QUERY = gql`
  query globalHistorySiteHistory(
    $path: String!
    $uiLanguage: String!
    $offset: Int!
    $limit: Int!
    $filter: InputGlobalHistoryFilter
    $sort: InputGlobalHistorySort
    $showDate: Boolean!
    $showUser: Boolean!
    $showName: Boolean!
    $showProperty: Boolean!
    $showLanguage: Boolean!
    $showAction: Boolean!
    $showPath: Boolean!
    $showUuid: Boolean!
    $showMessage: Boolean!
  ) {
    jcr {
      nodeByPath(path: $path) {
        uuid
        workspace
        displayName(language: $uiLanguage)
        globalHistory {
          totalCount(filter: $filter)
          entries(offset: $offset, limit: $limit, filter: $filter, sort: $sort) {
            id
            date @include(if: $showDate)
            uuid @include(if: $showUuid)
            path @include(if: $showPath)
            action @include(if: $showAction)
            propertyName @include(if: $showProperty)
            propertyNameDisplay(language: $uiLanguage) @include(if: $showProperty)
            userKey @include(if: $showUser)
            message @include(if: $showMessage)
            language @include(if: $showLanguage)
            nodeExists @include(if: $showName)
            nodeName @include(if: $showName)
            nodeNameDisplay(language: $uiLanguage) @include(if: $showName)
            user @include(if: $showUser) {
              username
              firstname
              lastname
              displayName
            }
          }
        }
      }
    }
  }
`;
