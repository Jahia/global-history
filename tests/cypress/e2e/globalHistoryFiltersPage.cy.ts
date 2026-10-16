import {
    COLUMN_LABELS,
    historyTotal,
    isInScope,
    PAGE_SIZE,
    SITE_KEY,
    SITE_PATH,
    TEXT_1_PATH,
    waitForStableTotal
} from '../support/globalHistory';

const TABLE = '[data-sel-role="site-history-table"]';
const ROWS = `${TABLE} tbody tr`;
const TOTAL_ITEMS = `${TABLE} [data-testid="pagination-total-items"]`;
const NEXT_PAGE = `${TABLE} [data-testid="pagination-button-next-page"]`;
const NO_MATCH = '[data-sel-role="site-history-no-match"]';
const ERROR = '[data-sel-role="site-history-error"]';
const PATH_FILTER = '[data-sel-role="filter-path"]';
const ACTION_FILTER = '[data-sel-role="filter-action"]';
const DATE_FROM = '[data-sel-role="filter-date-from"]';
const DATE_TO = '[data-sel-role="filter-date-to"]';
const CLEAR_FILTERS = '[data-sel-role="filter-clear"]';
const LOAD_TIMEOUT = 30000;
const UI_LOCALE = 'en';

const textsOf = ($elements: JQuery<HTMLElement>) =>
    Cypress.$.makeArray($elements).map(element => (element.textContent ?? '').trim());

const cellsOf = (columnLabel: string) => `${ROWS} td:nth-child(${COLUMN_LABELS.indexOf(columnLabel) + 1})`;

const totalOf = (paginationText: string): number => Number(/ of (\d+)$/.exec(paginationText)?.[1]);

const dayFromToday = (days: number): Date => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
};

const selectAction = (label: string) => {
    cy.get(`${ACTION_FILTER} [role="listbox"]`).click();
    cy.contains(`${ACTION_FILTER} menu [role="option"]`, new RegExp(`^${label}$`)).click();
    // A Dropdown with several values keeps its menu open, and a click on its overlay closes it.
    cy.get(`${ACTION_FILTER} .moonstone-menu_overlay`).click();
};

// DateTimeInput reads the digits in the order of its locale, and Enter commits the typed date.
const typeDate = (selector: string, date: Date) => {
    const text = new Intl.DateTimeFormat(UI_LOCALE).format(date);
    cy.get(selector).clear();
    cy.get(selector).type(`${text}{enter}`);
    cy.get(selector).should('have.value', text);
};

// The table keeps the previous rows while a query runs, and aria-busy marks that state.
const waitForFilteredRows = () => {
    cy.get(CLEAR_FILTERS).should('not.be.disabled');
    cy.get(TABLE, {timeout: LOAD_TIMEOUT}).should('have.attr', 'aria-busy', 'false');
};

describe('Site history filters', () => {
    let total: number;

    before(() => {
        waitForStableTotal(SITE_PATH).then(count => {
            total = count;
        });
    });

    beforeEach(() => {
        cy.login();
        cy.visit(`/jahia/jcontent/${SITE_KEY}/en/apps/siteHistory`);
        cy.get(ROWS, {timeout: LOAD_TIMEOUT}).should('have.length', PAGE_SIZE);
        cy.get(TOTAL_ITEMS)
            .invoke('text')
            .should('match', new RegExp(`^1-${PAGE_SIZE} of ${total}$`));
        cy.get(CLEAR_FILTERS).should('be.disabled');
    });

    it('lists the rows of the selected action', () => {
        selectAction('Published');
        cy.get(TOTAL_ITEMS, {timeout: LOAD_TIMEOUT}).should($total => {
            expect(totalOf($total.text()), 'total of the published rows').to.be.above(0).and.below(total);
        });
        cy.get(cellsOf('Action')).should($cells => {
            const actions = textsOf($cells);
            expect(actions, 'Action cells').not.to.be.empty;
            expect(Cypress._.uniq(actions), 'Action cells').to.deep.equal(['Published']);
        });
    });

    it('returns to page 1 when a filter changes', () => {
        historyTotal(SITE_PATH, {actions: ['created']}).then(createdTotal => {
            expect(createdTotal, 'created rows, more than one page').to.be.above(PAGE_SIZE);
            cy.get(NEXT_PAGE).click();
            cy.get(TOTAL_ITEMS)
                .invoke('text')
                .should('match', new RegExp(`^${PAGE_SIZE + 1}-`));
            selectAction('Created');
            cy.get(TOTAL_ITEMS, {timeout: LOAD_TIMEOUT})
                .invoke('text')
                .should('match', new RegExp(`^1-${PAGE_SIZE} of ${createdTotal}$`));
        });
    });

    it('shows no row from tomorrow on', () => {
        typeDate(DATE_FROM, dayFromToday(1));
        cy.contains(NO_MATCH, 'No history entry matches the filters', {timeout: LOAD_TIMEOUT}).should('be.visible');
    });

    it('includes the rows of the end date and excludes the rows after it', () => {
        typeDate(DATE_TO, dayFromToday(0));
        waitForFilteredRows();
        cy.get(TOTAL_ITEMS)
            .invoke('text')
            .should('match', new RegExp(`^1-${PAGE_SIZE} of ${total}$`));

        historyTotal(SITE_PATH, {beforeTimestamp: dayFromToday(0).getTime()}).then(beforeToday => {
            expect(beforeToday, 'rows before today').to.be.below(total);
            typeDate(DATE_TO, dayFromToday(-1));
            if (beforeToday === 0) {
                cy.contains(NO_MATCH, 'No history entry matches the filters', {timeout: LOAD_TIMEOUT}).should(
                    'be.visible'
                );
            } else {
                cy.get(TOTAL_ITEMS, {timeout: LOAD_TIMEOUT})
                    .invoke('text')
                    .should('match', new RegExp(` of ${beforeToday}$`));
            }
        });
    });

    it('lists the rows of a path and of the paths below it', () => {
        cy.get(PATH_FILTER).type(`${TEXT_1_PATH}{enter}`);
        waitForFilteredRows();
        cy.get(cellsOf('Path')).should($cells => {
            const paths = textsOf($cells);
            expect(paths, 'Path cells').not.to.be.empty;
            expect(
                paths.filter(path => !isInScope(path, TEXT_1_PATH)),
                `paths outside ${TEXT_1_PATH}`
            ).to.deep.equal([]);
        });
    });

    it('states that a path outside the site is refused', () => {
        cy.get(PATH_FILTER).type('/sites/gh_10{enter}');
        cy.contains(ERROR, `The path must be ${SITE_PATH} or a path below it`, {timeout: LOAD_TIMEOUT}).should(
            'be.visible'
        );
    });

    it('clears every filter', () => {
        cy.get(PATH_FILTER).type(`${TEXT_1_PATH}{enter}`);
        selectAction('Published');
        typeDate(DATE_TO, dayFromToday(0));
        typeDate(DATE_FROM, dayFromToday(-30));
        cy.get(TOTAL_ITEMS, {timeout: LOAD_TIMEOUT}).should($total => {
            expect(totalOf($total.text()), 'total of the filtered rows').to.be.above(0).and.below(total);
        });

        cy.get(CLEAR_FILTERS).click();
        cy.get(TOTAL_ITEMS, {timeout: LOAD_TIMEOUT})
            .invoke('text')
            .should('match', new RegExp(`^1-${PAGE_SIZE} of ${total}$`));
        cy.get(PATH_FILTER).should('have.value', '');
        cy.get(`${ACTION_FILTER} .moonstone-dropdown_tags`).should('not.exist');
        cy.get(DATE_FROM).should('have.value', '');
        cy.get(DATE_TO).should('have.value', '');
        cy.get(CLEAR_FILTERS).should('be.disabled');
    });
});
