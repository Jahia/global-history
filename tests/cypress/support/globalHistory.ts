import {ApolloQueryResult, FetchResult} from '@apollo/client/core';

export const SITE_KEY = 'gh_1';
export const SITE_PATH = `/sites/${SITE_KEY}`;
// An unescaped `_` lets "/sites/gh_1" match "/sites/ghx1", and "/sites/gh_1%" matches "/sites/gh_10".
export const LOOKALIKE_SITE_KEYS = ['ghx1', 'gh_10'];
export const ALL_SITE_KEYS = [SITE_KEY, ...LOOKALIKE_SITE_KEYS];
export const TEMPLATE_SET = 'templates-system';

export const CONTENT_FOLDER = 'gh-content';
export const CONTENT_FOLDER_PATH = `${SITE_PATH}/contents/${CONTENT_FOLDER}`;
export const TEXT_COUNT = 12;
export const TEXT_1_PATH = `${CONTENT_FOLDER_PATH}/text-1`;
export const AUTHOR_FOLDER = 'gh-author-content';
export const AUTHOR_FOLDER_PATH = `${SITE_PATH}/contents/${AUTHOR_FOLDER}`;
export const AUTHOR_TEXT_COUNT = 2;

export const MAX_LIMIT = 100;
// The limit of the GraphQL field when the request sets none.
export const DEFAULT_LIMIT = 20;
// The rows on one page of the Site history table, and the choices of its page size.
export const PAGE_SIZE = 100;
export const PAGE_SIZE_OPTIONS = ['20', '50', '100'];
export const HISTORY_TIMEOUT = 60000;

export const EDITOR = {username: 'gh-editor', password: 'password123'};
// The second user with rows on gh_1, for the user filter.
export const AUTHOR = {username: 'gh-author', password: 'password123'};
// A site administrator of gh_1 and an editor of ghx1, for the permission on another site.
export const SITE_ADMIN = {username: 'gh-site-admin', password: 'password123'};
// A user with a role that holds viewHistoryTab and no viewGlobalHistory.
export const TAB_VIEWER = {username: 'gh-tab-viewer', password: 'password123'};
export const SERVER_ADMIN = {username: 'gh-server-admin', password: 'password123'};

// The column menu names each column, and the header of the Locate column is empty.
export const COLUMN_LABELS = [
    'Date',
    'User',
    'Name',
    'Property',
    'Language',
    'Action',
    'Locate',
    'Path',
    'UUID',
    'Message'
];
export const LOCATE_LABEL = 'Locate';
export const headerTexts = (labels: string[]): string[] => labels.map(label => (label === LOCATE_LABEL ? '' : label));
// The table hides these columns until the user shows them.
export const HIDDEN_BY_DEFAULT = ['UUID', 'Message'];
export const DEFAULT_COLUMN_LABELS = COLUMN_LABELS.filter(label => !HIDDEN_BY_DEFAULT.includes(label));
// The local storage key of the column choice, and a value that shows every column.
export const COLUMNS_STORAGE_KEY = 'globalHistory.columns';
export const ALL_COLUMNS_SHOWN = JSON.stringify({uuid: true, message: true});

export type HistoryEntry = {
    id: string;
    timestamp: number | null;
    uuid: string | null;
    path: string | null;
    action: string | null;
    propertyName: string | null;
    userKey: string | null;
    message: string | null;
    language: string | null;
    nodeExists: boolean | null;
    nodeName: string | null;
};

export type GlobalHistory = {
    totalCount: number;
    entries: HistoryEntry[];
};

export type HistoryFilter = {
    actions?: string[];
    userKeys?: string[];
    fromTimestamp?: number;
    beforeTimestamp?: number;
    path?: string;
};

export type HistorySortField = 'DATE' | 'USER' | 'ACTION' | 'PATH' | 'PROPERTY' | 'UUID' | 'MESSAGE';

export type HistorySort = {
    field: HistorySortField;
    direction: 'ASC' | 'DESC';
};

type GraphqlResult = ApolloQueryResult<unknown> | FetchResult;

type HistoryData = {
    jcr?: {nodeByPath?: {uuid?: string; globalHistory?: {totalCount: number; entries?: (HistoryEntry | null)[]}}};
};

const MAX_PAGES = 20;

export const serverNameOf = (siteKey: string): string => siteKey.replace(/_/g, '-');

export const isInScope = (path: string | null, scopePath: string): boolean =>
    path === scopePath || (path ?? '').startsWith(`${scopePath}/`);

export const textNodes = (count: number) =>
    Array.from({length: count}, (_, index) => ({
        name: `text-${index + 1}`,
        primaryNodeType: 'jnt:text',
        properties: [{name: 'text', value: `Global history text ${index + 1}`, language: 'en'}]
    }));

const historyOf = (result: GraphqlResult, path: string): GlobalHistory => {
    expect(result.errors, `GraphQL errors on the history of ${path}: ${JSON.stringify(result.errors)}`).to.be.undefined;
    const history = (result.data as HistoryData | undefined)?.jcr?.nodeByPath?.globalHistory;
    expect(history, `globalHistory of ${path}`).to.be.an('object');
    return {totalCount: history.totalCount, entries: (history.entries ?? []).filter(Boolean)};
};

export const historyPage = (
    path: string,
    offset: number,
    limit: number | null,
    {filter, sort}: {filter?: HistoryFilter; sort?: HistorySort} = {}
): Cypress.Chainable<GlobalHistory> =>
    cy
        .apollo({
            queryFile: 'graphql/globalHistory/historyPage.graphql',
            variables: {path, offset, limit, filter, sort},
            errorPolicy: 'all'
        })
        .then(result => historyOf(result, path));

export const historyTotal = (path: string, filter?: HistoryFilter): Cypress.Chainable<number> =>
    cy
        .apollo({queryFile: 'graphql/globalHistory/totalCount.graphql', variables: {path, filter}, errorPolicy: 'all'})
        .then(result => historyOf(result, path).totalCount);

export const nodeUuid = (path: string): Cypress.Chainable<string> =>
    cy
        .apollo({queryFile: 'graphql/globalHistory/nodeUuid.graphql', variables: {path}, errorPolicy: 'all'})
        .then(result => {
            const uuid = (result.data as HistoryData | undefined)?.jcr?.nodeByPath?.uuid;
            expect(uuid, `uuid of ${path}`).to.be.a('string');
            return uuid;
        });

// Reads the history of a path 100 rows at a time, newest first, until isDone holds or no row is left.
export const collectEntries = (
    path: string,
    isDone: (entries: HistoryEntry[]) => boolean,
    filter?: HistoryFilter,
    collected: HistoryEntry[] = []
): Cypress.Chainable<HistoryEntry[]> =>
    historyPage(path, collected.length, MAX_LIMIT, {filter}).then(page => {
        const entries = collected.concat(page.entries);
        const isLastPage = page.entries.length === 0 || entries.length >= page.totalCount;
        if (isDone(entries) || isLastPage || entries.length >= MAX_PAGES * MAX_LIMIT) {
            return cy.wrap(entries, {log: false});
        }

        return collectEntries(path, isDone, filter, entries);
    });

// Reads every row of a path in the order of the sort, 100 rows at a time.
export const sortedEntries = (
    path: string,
    sort: HistorySort,
    collected: HistoryEntry[] = []
): Cypress.Chainable<HistoryEntry[]> =>
    historyPage(path, collected.length, MAX_LIMIT, {sort}).then(page => {
        const entries = collected.concat(page.entries);
        if (page.entries.length === 0 || entries.length >= page.totalCount) {
            return cy.wrap(entries, {log: false});
        }

        return sortedEntries(path, sort, entries);
    });

export const hasActionForEach = (entries: HistoryEntry[], uuids: string[], action: string): boolean =>
    uuids.every(uuid => entries.some(entry => entry.uuid === uuid && entry.action === action));

// History rows are written asynchronously, so every check on them polls.
export const waitForEntries = (
    path: string,
    isDone: (entries: HistoryEntry[]) => boolean,
    errorMsg: string
): Cypress.Chainable<HistoryEntry[]> =>
    cy.waitUntil(() => collectEntries(path, isDone).then(entries => (isDone(entries) ? entries : false)), {
        timeout: HISTORY_TIMEOUT,
        interval: 1000,
        errorMsg
    }) as Cypress.Chainable<HistoryEntry[]>;

export const waitForAction = (path: string, uuids: string[], action: string): Cypress.Chainable<HistoryEntry[]> =>
    waitForEntries(
        path,
        entries => hasActionForEach(entries, uuids, action),
        `The history of ${path} has no "${action}" row for each of ${uuids.length} nodes`
    );

export const waitForStableTotal = (path: string): Cypress.Chainable<number> => {
    let previous = -1;
    return cy.waitUntil(
        () =>
            historyTotal(path).then(total => {
                const isStable = total > 0 && total === previous;
                previous = total;
                return isStable ? total : 0;
            }),
        {timeout: HISTORY_TIMEOUT, interval: 2000, errorMsg: `The history of ${path} did not stop growing`}
    );
};
