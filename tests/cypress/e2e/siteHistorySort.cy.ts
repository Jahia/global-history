import {
    historyPage,
    HistoryEntry,
    HistorySortField,
    MAX_LIMIT,
    SITE_PATH,
    sortedEntries,
    waitForStableTotal
} from '../support/siteHistory';

type Value = string | number | null;

type SortCase = {
    field: HistorySortField;
    valueOf: (entry: HistoryEntry) => Value;
    // The values hold lower-case letters, digits and "-" only, so every database collation orders them as JavaScript does.
    isPlainText?: boolean;
};

const SORT_CASES: SortCase[] = [
    {field: 'USER', valueOf: entry => entry.userKey, isPlainText: true},
    {field: 'ACTION', valueOf: entry => entry.action, isPlainText: true},
    {field: 'PATH', valueOf: entry => entry.path},
    {field: 'PROPERTY', valueOf: entry => entry.propertyName},
    {field: 'UUID', valueOf: entry => entry.uuid, isPlainText: true},
    {field: 'MESSAGE', valueOf: entry => entry.message}
];

const idsOf = (entries: HistoryEntry[]): string[] => entries.map(entry => entry.id);

const expectEveryRowOnce = (entries: HistoryEntry[], newestFirst: HistoryEntry[], label: string) => {
    expect(entries, `${label}: rows`).to.have.length(newestFirst.length);
    expect(new Set(idsOf(entries)).size, `${label}: distinct rows`).to.equal(newestFirst.length);
    expect([...idsOf(entries)].sort(), `${label}: the rows of the site`).to.deep.equal([...idsOf(newestFirst)].sort());
};

// A sorted list puts the rows of one value next to each other.
const expectOneRunPerValue = (values: Value[], label: string) => {
    const runStarts = values.filter((value, index) => index === 0 || value !== values[index - 1]);
    expect(runStarts, `${label}: one run per value`).to.have.length(new Set(values).size);
};

const expectNewestFirstPerValue = (entries: HistoryEntry[], valueOf: (entry: HistoryEntry) => Value, label: string) => {
    const misplaced = entries.filter(
        (entry, index) =>
            index > 0 &&
            valueOf(entry) === valueOf(entries[index - 1]) &&
            entry.timestamp > entries[index - 1].timestamp
    );
    expect(idsOf(misplaced), `${label}: rows newer than the previous row of the same value`).to.deep.equal([]);
};

const expectSortedBothWays = (
    {field, valueOf, isPlainText}: SortCase,
    ascending: HistoryEntry[],
    descending: HistoryEntry[],
    newestFirst: HistoryEntry[]
) => {
    expectEveryRowOnce(ascending, newestFirst, `${field} ASC`);
    expectEveryRowOnce(descending, newestFirst, `${field} DESC`);
    const ascendingValues = ascending.map(valueOf);
    expect(descending.map(valueOf), `${field} DESC values`).to.deep.equal([...ascendingValues].reverse());
    expectOneRunPerValue(ascendingValues, `${field} ASC`);
    if (isPlainText) {
        expect(ascendingValues, `${field} ASC values`).to.deep.equal([...ascendingValues].sort());
    }

    expectNewestFirstPerValue(ascending, valueOf, `${field} ASC`);
    expectNewestFirstPerValue(descending, valueOf, `${field} DESC`);
};

describe('Sort of the site history', () => {
    let newestFirst: HistoryEntry[];

    before(() => {
        waitForStableTotal(SITE_PATH);
        sortedEntries(SITE_PATH, {field: 'DATE', direction: 'DESC'}).then(entries => {
            newestFirst = entries;
        });
    });

    it('lists the newest rows first when the request sets no sort', () => {
        historyPage(SITE_PATH, 0, MAX_LIMIT).then(page => {
            expect(idsOf(page.entries), 'first page without a sort').to.deep.equal(
                idsOf(newestFirst.slice(0, MAX_LIMIT))
            );
        });
    });

    it('sorts the rows by date both ways', () => {
        expectEveryRowOnce(newestFirst, newestFirst, 'DATE DESC');
        const timestamps = newestFirst.map(entry => entry.timestamp);
        expect(timestamps, 'DATE DESC').to.deep.equal([...timestamps].sort((a, b) => b - a));
        sortedEntries(SITE_PATH, {field: 'DATE', direction: 'ASC'}).then(oldestFirst => {
            expectEveryRowOnce(oldestFirst, newestFirst, 'DATE ASC');
            expect(idsOf(oldestFirst), 'DATE ASC').to.deep.equal(idsOf(newestFirst).reverse());
        });
    });

    SORT_CASES.forEach(sortCase => {
        it(`sorts the rows by ${sortCase.field} both ways, and lists the newest row first among equal values`, () => {
            let ascending: HistoryEntry[];
            sortedEntries(SITE_PATH, {field: sortCase.field, direction: 'ASC'}).then(entries => {
                ascending = entries;
            });
            sortedEntries(SITE_PATH, {field: sortCase.field, direction: 'DESC'}).then(descending =>
                expectSortedBothWays(sortCase, ascending, descending, newestFirst)
            );
        });
    });
});
