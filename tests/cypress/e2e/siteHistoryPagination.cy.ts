import {
    SiteHistory,
    historyPage,
    DEFAULT_LIMIT,
    MAX_LIMIT,
    SITE_PATH,
    waitForStableTotal
} from '../support/siteHistory';

const idsOf = (page: SiteHistory) => page.entries.map(entry => entry.id);

describe('siteHistory pagination', () => {
    let total: number;

    before(() => {
        waitForStableTotal(SITE_PATH).then(count => {
            total = count;
        });
    });

    it('returns disjoint pages that follow each other', () => {
        expect(total, `rows of ${SITE_PATH}`).to.be.at.least(10);
        const pages: SiteHistory[] = [];
        [
            [0, 10],
            [0, 5],
            [5, 5]
        ].forEach(([offset, limit]) =>
            historyPage(SITE_PATH, offset, limit).then(page => {
                pages.push(page);
            })
        );

        cy.then(() => {
            const [both, first, second] = pages;
            const secondIds = idsOf(second);
            expect(
                idsOf(first).filter(id => secondIds.includes(id)),
                'rows on both pages'
            ).to.deep.equal([]);
            expect([...idsOf(first), ...secondIds], 'page 1 then page 2').to.deep.equal(idsOf(both));
            expect(
                pages.map(page => page.totalCount),
                'totalCount'
            ).to.deep.equal([total, total, total]);
        });
    });

    it('orders the rows newest first', () => {
        historyPage(SITE_PATH, 0, MAX_LIMIT).then(page => {
            const timestamps = page.entries.map(entry => entry.timestamp ?? 0);
            expect(timestamps).to.deep.equal([...timestamps].sort((a, b) => b - a));
        });
    });

    it('ends the last page at totalCount', () => {
        historyPage(SITE_PATH, total - 3, 10).then(page => {
            expect(page.entries, 'rows of the last page').to.have.length(3);
        });
        historyPage(SITE_PATH, total, 10).then(page => {
            expect(page.totalCount, 'totalCount').to.equal(total);
            expect(page.entries, 'rows after the last page').to.deep.equal([]);
        });
    });

    it('defaults the limit to 20 and clamps it to 100', () => {
        historyPage(SITE_PATH, 0, null).then(page => {
            expect(page.entries, 'rows without a limit').to.have.length(Math.min(DEFAULT_LIMIT, total));
        });
        historyPage(SITE_PATH, 0, 1000).then(page => {
            expect(page.entries, 'rows for limit 1000').to.have.length(Math.min(MAX_LIMIT, total));
        });
    });

    it('rejects a negative offset', () => {
        cy.apollo({
            queryFile: 'graphql/siteHistory/historyPage.graphql',
            variables: {path: SITE_PATH, offset: -1, limit: 5},
            errorPolicy: 'all'
        }).then(result => {
            expect(result.data?.jcr?.nodeByPath?.siteHistory?.totalCount, 'totalCount').to.equal(total);
            expect((result.errors ?? []).map(error => error.message).join('\n'), 'error').to.match(/offset/);
        });
    });
});
