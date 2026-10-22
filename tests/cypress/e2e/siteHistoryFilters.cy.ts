import {
    AUTHOR,
    collectEntries,
    CONTENT_FOLDER_PATH,
    SiteHistory,
    HistoryEntry,
    HistoryFilter,
    historyPage,
    historyTotal,
    isInScope,
    MAX_LIMIT,
    nodeUuid,
    SITE_PATH,
    TEXT_1_PATH,
    waitForAction,
    waitForStableTotal
} from '../support/siteHistory';

const PAGE_QUERY = 'graphql/siteHistory/historyPage.graphql';
const TRANSLATION_PATH = `${TEXT_1_PATH}/j:translation_en`;

const idsOf = (entries: HistoryEntry[]) => entries.map(entry => entry.id);

const otherActions = (entries: HistoryEntry[], actions: string[]) =>
    entries.filter(entry => !actions.includes(entry.action)).map(entry => entry.action);

const otherUsers = (entries: HistoryEntry[], userKeys: string[]) =>
    entries.filter(entry => !userKeys.includes(entry.userKey)).map(entry => entry.userKey);

const outOfScopePaths = (entries: HistoryEntry[], scopePath: string) =>
    entries.filter(entry => !isInScope(entry.path, scopePath)).map(entry => entry.path);

const timestampsOtherThan = (entries: HistoryEntry[], timestamp: number) =>
    entries.map(entry => entry.timestamp).filter(entryTimestamp => entryTimestamp !== timestamp);

const timestampsFrom = (entries: HistoryEntry[], timestamp: number) =>
    entries.map(entry => entry.timestamp).filter(entryTimestamp => entryTimestamp >= timestamp);

const createdRowOf = (path: string): Cypress.Chainable<HistoryEntry> =>
    nodeUuid(path).then(uuid =>
        waitForAction(path, [uuid], 'created').then(entries =>
            entries.find(entry => entry.uuid === uuid && entry.action === 'created')
        )
    );

const filteredEntries = (filter: HistoryFilter): Cypress.Chainable<HistoryEntry[]> =>
    historyTotal(SITE_PATH, filter).then(count =>
        collectEntries(SITE_PATH, () => false, filter).then(entries => {
            expect(entries, `rows read for ${JSON.stringify(filter)}, against totalCount`).to.have.length(count);
            return entries;
        })
    );

// The count of the rows of each user, in the order of userKeys.
const userTotals = (userKeys: string[], filter: HistoryFilter = {}): Cypress.Chainable<number[]> => {
    const totals: number[] = [];
    userKeys.forEach(userKey =>
        historyTotal(SITE_PATH, {...filter, userKeys: [userKey]}).then(count => {
            totals.push(count);
        })
    );
    return cy.wrap(totals, {log: false});
};

const expectRefused = (filter: HistoryFilter, message: RegExp) =>
    cy
        .apollo({
            queryFile: PAGE_QUERY,
            variables: {path: SITE_PATH, offset: 0, limit: 1, filter},
            errorPolicy: 'all'
        })
        .then(result => {
            const messages = (result.errors ?? []).map(error => error.message).join('\n');
            expect(messages, `error for ${JSON.stringify(filter)}`).to.match(message);
            expect(
                result.data?.jcr?.nodeByPath?.siteHistory?.entries ?? [],
                `rows for ${JSON.stringify(filter)}`
            ).to.deep.equal([]);
        });

describe('siteHistory filters', () => {
    let total: number;

    before(() => {
        waitForStableTotal(SITE_PATH).then(count => {
            total = count;
        });
    });

    it('keeps the rows of the selected actions', () => {
        filteredEntries({actions: ['published']}).then(entries => {
            expect(entries, 'published rows').not.to.be.empty;
            expect(entries.length, 'published rows against all rows').to.be.below(total);
            expect(otherActions(entries, ['published']), 'actions other than published').to.deep.equal([]);
        });
    });

    it('keeps the rows of a time range, with the start included and the end excluded', () => {
        createdRowOf(CONTENT_FOLDER_PATH).then(created => {
            const timestamp = created.timestamp;
            expect(timestamp, 'timestamp of the created row of the folder').to.be.a('number');

            filteredEntries({fromTimestamp: timestamp, beforeTimestamp: timestamp + 1}).then(entries => {
                expect(idsOf(entries), 'rows of the millisecond of the created row').to.include(created.id);
                expect(timestampsOtherThan(entries, timestamp), 'timestamps of the other rows').to.deep.equal([]);
            });

            historyPage(SITE_PATH, 0, MAX_LIMIT, {filter: {beforeTimestamp: timestamp}}).then(page => {
                expect(page.entries, 'rows before the created row').not.to.be.empty;
                expect(timestampsFrom(page.entries, timestamp), 'timestamps at or after the end').to.deep.equal([]);
                expect(idsOf(page.entries), 'rows before the created row').not.to.include(created.id);
            });
        });
    });

    it('keeps the rows of a path and of the paths below it', () => {
        filteredEntries({path: TEXT_1_PATH}).then(entries => {
            expect(
                entries.map(entry => entry.path),
                `paths of the rows of ${TEXT_1_PATH}`
            ).to.include(TEXT_1_PATH);
            expect(outOfScopePaths(entries, TEXT_1_PATH), 'paths outside text-1, such as text-10').to.deep.equal([]);
        });
    });

    it('reads _ in a path as a character, not as a wildcard', () => {
        historyTotal(SITE_PATH, {path: TEXT_1_PATH}).then(count => {
            expect(count, `rows of ${TEXT_1_PATH}`).to.be.above(0);
        });
        historyTotal(SITE_PATH, {path: `${CONTENT_FOLDER_PATH}/text-_`}).then(count => {
            expect(count, 'rows of text-_').to.equal(0);
        });
    });

    it('refuses a path outside the site and a path with a character class', () => {
        expectRefused({path: '/sites/sh_10/contents'}, /path must be/);
        expectRefused({path: '/'}, /path must be/);
        expectRefused({path: `${SITE_PATH}/[a-z]`}, /path must not contain \[ or \]/);
    });

    it('accepts 20 actions and refuses 21', () => {
        const actions = Array.from({length: 21}, (_, index) => `action-${index + 1}`);
        historyTotal(SITE_PATH, {actions: actions.slice(0, 20)}).then(count => {
            expect(count, 'rows of 20 unknown actions').to.equal(0);
        });
        expectRefused({actions}, /actions/);
    });

    it('keeps the rows of the selected users', () => {
        const userKeys = ['root', AUTHOR.username];
        userTotals(userKeys).then(([rootTotal, authorTotal]) => {
            expect(rootTotal, 'rows of root').to.be.above(0).and.below(total);
            expect(authorTotal, 'rows of sh-author').to.be.above(0).and.below(total);
            historyTotal(SITE_PATH, {userKeys}).then(count => {
                expect(count, 'rows of root and sh-author').to.equal(rootTotal + authorTotal);
            });
        });

        // The rows of the sh_1 sites of earlier runs stay in the table, so the rows are read from this run on.
        let since: HistoryFilter;
        let runTotals: number[];
        createdRowOf(CONTENT_FOLDER_PATH).then(created => {
            since = {fromTimestamp: created.timestamp};
            userTotals(userKeys, since).then(totals => {
                runTotals = totals;
            });
        });
        cy.then(() => filteredEntries({...since, userKeys: [AUTHOR.username]})).then(entries => {
            expect(entries, 'rows of sh-author in this run').not.to.be.empty;
            expect(otherUsers(entries, [AUTHOR.username]), 'users other than sh-author').to.deep.equal([]);
        });
        cy.then(() => filteredEntries({...since, userKeys})).then(entries => {
            expect(entries, 'rows of root and sh-author in this run').to.have.length(runTotals[0] + runTotals[1]);
            expect(
                Cypress._.uniq(entries.map(entry => entry.userKey)).sort(),
                'users of the rows of root and sh-author'
            ).to.deep.equal([AUTHOR.username, 'root'].sort());
        });
    });

    it('reads a blank user key as no user filter', () => {
        historyTotal(SITE_PATH, {userKeys: ['']}).then(count => {
            expect(count, 'rows for the user key ""').to.equal(total);
        });
    });

    it('accepts 100 user keys and refuses 101', () => {
        const userKeys = Array.from({length: 101}, (_, index) => `user-${index + 1}`);
        historyTotal(SITE_PATH, {userKeys: userKeys.slice(0, 100)}).then(count => {
            expect(count, 'rows of 100 unknown users').to.equal(0);
        });
        // A blank key and a duplicate do not count toward the limit of 100 keys.
        historyTotal(SITE_PATH, {userKeys: [...userKeys.slice(0, 100), '', 'user-1']}).then(count => {
            expect(count, 'rows of 100 unknown users, a blank key and a duplicate').to.equal(0);
        });
        expectRefused({userKeys}, /userKeys must hold at most 100 values, got 101/);
    });

    it('combines the action and the path', () => {
        filteredEntries({actions: ['published'], path: TEXT_1_PATH}).then(entries => {
            expect(
                entries.map(entry => entry.path),
                'paths of the published rows'
            ).to.include.members([TEXT_1_PATH, TRANSLATION_PATH]);
            expect(otherActions(entries, ['published']), 'actions other than published').to.deep.equal([]);
            expect(outOfScopePaths(entries, TEXT_1_PATH), `paths outside ${TEXT_1_PATH}`).to.deep.equal([]);
        });
    });

    it('counts and pages the rows of a filter', () => {
        const actions = ['created', 'added'];
        const pages: SiteHistory[] = [];
        [
            [0, 10],
            [0, 5],
            [5, 5]
        ].forEach(([offset, limit]) =>
            historyPage(SITE_PATH, offset, limit, {filter: {actions}}).then(page => {
                pages.push(page);
            })
        );

        cy.then(() => {
            const [both, first, second] = pages;
            const count = both.totalCount;
            expect(count, 'created and added rows').to.be.at.least(10).and.below(total);
            expect([...idsOf(first.entries), ...idsOf(second.entries)], 'page 1 then page 2').to.deep.equal(
                idsOf(both.entries)
            );
            expect(otherActions(both.entries, actions), 'actions other than created and added').to.deep.equal([]);

            const totals = pages.map(page => page.totalCount);

            historyPage(SITE_PATH, count - 3, 10, {filter: {actions}}).then(last => {
                expect(last.entries, 'rows of the last page').to.have.length(3);
                expect([...totals, last.totalCount], 'totalCount').to.deep.equal([count, count, count, count]);
            });
        });
    });
});
