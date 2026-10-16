import { gql } from "@apollo/client";

export type HistoryUser = {
  username: string | null;
  firstname: string | null;
  lastname: string | null;
  displayName: string | null;
};

export type HistoryEntry = {
  id: string;
  date: string | null;
  uuid: string | null;
  path: string | null;
  action: string | null;
  propertyName: string | null;
  propertyNameDisplay: string | null;
  userKey: string | null;
  message: string | null;
  language: string | null;
  nodeExists: boolean | null;
  nodeName: string | null;
  nodeNameDisplay: string | null;
  user: HistoryUser | null;
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

export type SiteHistoryVariables = {
  path: string;
  uiLanguage: string;
  offset: number;
  limit: number;
};

export const SITE_HISTORY_QUERY = gql`
  query globalHistorySiteHistory($path: String!, $uiLanguage: String!, $offset: Int!, $limit: Int!) {
    jcr {
      nodeByPath(path: $path) {
        uuid
        workspace
        displayName(language: $uiLanguage)
        globalHistory {
          totalCount
          entries(offset: $offset, limit: $limit) {
            id
            date
            uuid
            path
            action
            propertyName
            propertyNameDisplay(language: $uiLanguage)
            userKey
            message
            language
            nodeExists
            nodeName
            nodeNameDisplay(language: $uiLanguage)
            user {
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
