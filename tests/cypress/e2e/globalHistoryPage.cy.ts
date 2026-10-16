import {COLUMN_LABELS, PAGE_SIZE, SITE_KEY, SITE_PATH, waitForStableTotal} from '../support/globalHistory';

const PAGE = '[data-sel-role="site-history"]';
const TABLE = '[data-sel-role="site-history-table"]';
const ROWS = `${TABLE} tbody tr`;
const TOTAL_ITEMS = `${TABLE} [data-testid="pagination-total-items"]`;
const NEXT_PAGE = `${TABLE} [data-testid="pagination-button-next-page"]`;
const LOAD_TIMEOUT = 30000;

const textsOf = ($elements: JQuery<HTMLElement>) =>
    Cypress.$.makeArray($elements).map(element => (element.textContent ?? '').trim());

describe('Site history page', () => {
    let total: number;

    before(() => {
        waitForStableTotal(SITE_PATH).then(count => {
            total = count;
        });
    });

    beforeEach(() => {
        cy.login();
        cy.visit(`/jahia/jcontent/${SITE_KEY}/en/apps/siteHistory`);
    });

    it('shows the header, the nine columns and the first page of rows', () => {
        expect(total, 'page 2 needs more rows than one page').to.be.above(PAGE_SIZE);
        cy.contains(PAGE, `Site history: ${SITE_KEY}`, {timeout: LOAD_TIMEOUT}).should('be.visible');
        cy.get(`${TABLE} thead th`, {timeout: LOAD_TIMEOUT}).should($cells => {
            expect(textsOf($cells), 'column headers').to.deep.equal(COLUMN_LABELS);
        });
        cy.get(ROWS).should('have.length', PAGE_SIZE);
        cy.get(TOTAL_ITEMS)
            .invoke('text')
            .should('match', new RegExp(`^1-${PAGE_SIZE} of \\d+$`));
    });

    it('loads page 2', () => {
        cy.get(ROWS, {timeout: LOAD_TIMEOUT}).should('have.length', PAGE_SIZE);
        cy.get(ROWS).then($firstPage => {
            const firstPage = textsOf($firstPage);
            cy.get(NEXT_PAGE).click();
            cy.get(TOTAL_ITEMS)
                .invoke('text')
                .should('match', new RegExp(`^${PAGE_SIZE + 1}-\\d+ of \\d+$`));
            cy.get(ROWS, {timeout: LOAD_TIMEOUT}).should($secondPage => {
                expect($secondPage.length, 'rows on page 2').to.equal(Math.min(PAGE_SIZE, total - PAGE_SIZE));
                expect(textsOf($secondPage), 'rows on page 2').not.to.deep.equal(firstPage);
            });
        });
    });
});
