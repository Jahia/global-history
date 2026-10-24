import {
    AUTHOR,
    CONTENT_FOLDER,
    CONTENT_FOLDER_PATH,
    DEFAULT_COLUMN_LABELS,
    HistoryFilter,
    historyTotal,
    isInScope,
    PAGE_SIZE,
    SITE_KEY,
    SITE_PATH,
    TEXT_1_PATH,
    waitForStableTotal
} from '../support/siteHistory';

const TABLE = '[data-sel-role="site-history-table"]';
const ROWS = `${TABLE} tbody tr`;
const TOTAL_ITEMS = `${TABLE} [data-testid="pagination-total-items"]`;
const NEXT_PAGE = `${TABLE} [data-testid="pagination-button-next-page"]`;
const NO_MATCH = '[data-sel-role="site-history-no-match"]';
const ERROR = '[data-sel-role="site-history-error"]';
const PATH_FILTER = '[data-sel-role="filter-path"]';
const PATH_PICKER_BUTTON = '[data-sel-role="filter-path-picker"]';
const ACTION_FILTER = '[data-sel-role="filter-action"]';
const DATE_FROM = '[data-sel-role="filter-date-from"]';
const DATE_TO = '[data-sel-role="filter-date-to"]';
const USER_FILTER = '[data-sel-role="filter-user"]';
const USER_PICKER_BUTTON = '[data-sel-role="filter-user-picker"]';
const CLEAR_FILTERS = '[data-sel-role="filter-clear"]';
const COLUMN_CHOICE = '[data-sel-role="column-choice"]';
const FILTER_CONTROLS = [DATE_FROM, DATE_TO, USER_FILTER, PATH_FILTER, ACTION_FILTER, COLUMN_CHOICE];
const PICKER = '[data-sel-role="picker-dialog"][data-sel-type="user"]';
const EDITORIAL_PICKER = '[data-sel-role="picker-dialog"][data-sel-type="editorial"]';
const CONTENT_FOLDERS_ACCORDION =
    'section[data-registry-key="accordionItem:picker-content-folders"] header[role="accordion-item"]';
const PICKER_SEARCH = `${PICKER} input[role="searchbox"]`;
const PICKER_SELECTION = `${PICKER} [data-cm-role="selection-caption"]`;
const PAGE = '[data-sel-role="site-history"]';
const FILTERS = '[data-sel-role="site-history-filters"]';
const LOAD_TIMEOUT = 30000;
const UI_LOCALE = 'en';

const textsOf = ($elements: JQuery<HTMLElement>) =>
    Cypress.$.makeArray($elements).map(element => (element.textContent ?? '').trim());

const outsideOf = (paths: string[], scopePath: string): string[] => paths.filter(path => !isInScope(path, scopePath));

const cellsOf = (columnLabel: string) => `${ROWS} td:nth-child(${DEFAULT_COLUMN_LABELS.indexOf(columnLabel) + 1})`;

// The data-sel-role of a moonstone Input sits on the input element, inside the box that holds its buttons.
const clearField = (selector: string) =>
    cy.get(selector).closest('.moonstone-baseInput').find('[aria-label="Reset"]').click();

// The commands fill the array before cy.wrap yields it.
const totalsOf = (...filters: HistoryFilter[]): Cypress.Chainable<number[]> => {
    const totals: number[] = [];
    filters.forEach(filter => historyTotal(SITE_PATH, filter).then(count => totals.push(count)));
    return cy.wrap(totals);
};

const boxOf = (element: HTMLElement): DOMRect => element.getBoundingClientRect();

const middleOf = (box: DOMRect): number => (box.top + box.bottom) / 2;

const totalOf = (paginationText: string): number => Number(/ of (\d+)$/.exec(paginationText)?.[1]);

const dayFromToday = (days: number): Date => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
};

// A click on a selected tag removes its action, so the menu opens once for all the labels.
const selectActions = (...labels: string[]) => {
    cy.get(`${ACTION_FILTER} [role="listbox"]`).click();
    labels.forEach(label => cy.contains(`${ACTION_FILTER} menu [role="option"]`, new RegExp(`^${label}$`)).click());
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

const pickerCheckbox = (username: string) =>
    `${PICKER} [data-cm-role="table-content-list-row"][data-sel-name="${username}"] [data-cm-role="table-content-list-cell-selection"] input`;

// The jContent user picker searches after 3 characters. With several users allowed, the checkbox of a row toggles the user.
const toggleUserInPicker = (username: string, checked: boolean) => {
    cy.get(PICKER_SEARCH, {timeout: LOAD_TIMEOUT}).should('be.visible').clear();
    cy.get(PICKER_SEARCH).type(username, {delay: 100});
    cy.get(pickerCheckbox(username), {timeout: LOAD_TIMEOUT}).click();
    cy.get(pickerCheckbox(username)).should('have.attr', 'aria-checked', String(checked));
};

const pickUser = (username: string) => {
    cy.get(USER_PICKER_BUTTON).click();
    toggleUserInPicker(username, true);
    cy.get(`${PICKER_SELECTION} [data-sel-role="1-item-selected"]`).should('be.visible');
    cy.get(`${PICKER} [data-sel-picker-dialog-action="done"]`).click();
    cy.get(PICKER).should('not.exist');
};

// The editorial picker opens on the Pages accordion. It selects a folder 300 ms after a click, because a double-click opens the folder.
const pickContentFolder = (folderName: string) => {
    cy.get(PATH_PICKER_BUTTON).click();
    cy.get(EDITORIAL_PICKER, {timeout: LOAD_TIMEOUT}).should('be.visible');
    cy.get(CONTENT_FOLDERS_ACCORDION).click();
    cy.get(`${EDITORIAL_PICKER} [data-cm-role="table-content-list-row"][data-sel-name="${folderName}"]`, {
        timeout: LOAD_TIMEOUT
    }).click();
    cy.get(`${EDITORIAL_PICKER} [data-cm-role="selection-caption"] [data-sel-role="item-selected"]`).should(
        'be.visible'
    );
    cy.get(`${EDITORIAL_PICKER} [data-sel-picker-dialog-action="done"]`).click();
    cy.get(EDITORIAL_PICKER).should('not.exist');
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

    it('shows the five controls and the column choice in one row between the header and the table', () => {
        cy.get(`${PAGE} header`).find(FILTER_CONTROLS.join(', ')).should('not.exist');
        cy.get(FILTERS).should($filters => {
            const filters = boxOf($filters[0]);
            expect(filters.top, 'top of the filters').to.be.at.least(boxOf(Cypress.$(`${PAGE} header`)[0]).bottom);
            expect(filters.bottom, 'bottom of the filters').to.be.at.most(boxOf(Cypress.$(TABLE)[0]).top);
            const controls = FILTER_CONTROLS.map(selector => {
                expect($filters.find(selector), `${selector} in the filters`).to.have.length(1);
                return boxOf($filters.find(selector)[0]);
            });
            controls.slice(1).forEach((control, index) => {
                expect(control.left, `left edge of ${FILTER_CONTROLS[index + 1]}`).to.be.above(controls[index].right);
                expect(middleOf(control), `middle of ${FILTER_CONTROLS[index + 1]}`).to.be.closeTo(
                    middleOf(controls[0]),
                    2
                );
            });
            expect(controls[controls.length - 1].right, 'right edge of the column choice').to.be.closeTo(
                filters.right,
                1
            );
        });
    });

    it('lists the rows of the selected action', () => {
        selectActions('Published');
        cy.get(TOTAL_ITEMS, {timeout: LOAD_TIMEOUT}).should($total => {
            expect(totalOf($total.text()), 'total of the published rows').to.be.above(0).and.below(total);
        });
        cy.get(cellsOf('Action')).should($cells => {
            const actions = textsOf($cells);
            expect(actions, 'Action cells').not.to.be.empty;
            expect(Cypress._.uniq(actions), 'Action cells').to.deep.equal(['Published']);
        });
    });

    it('keeps the action filter at the size of an empty filter with three actions selected', () => {
        selectActions('Published', 'Added', 'Created');
        cy.get(`${ACTION_FILTER} .moonstone-tag`).should('have.length', 3);
        cy.get(FILTERS).should($filters => {
            const action = boxOf($filters.find(ACTION_FILTER)[0]);
            expect(action.width, 'width of the action filter').to.be.closeTo(160, 0.5);
            expect(action.height, 'height of the action filter').to.be.closeTo(26, 0.5);
        });
    });

    // A fresh sh_1 has one "added" row for each of its 120 text nodes, more than one page.
    it('returns to page 1 when a filter changes', () => {
        historyTotal(SITE_PATH, {actions: ['added']}).then(addedTotal => {
            expect(addedTotal, 'added rows, more than one page').to.be.above(PAGE_SIZE);
            cy.get(NEXT_PAGE).click();
            cy.get(TOTAL_ITEMS)
                .invoke('text')
                .should('match', new RegExp(`^${PAGE_SIZE + 1}-`));
            selectActions('Added');
            cy.get(TOTAL_ITEMS, {timeout: LOAD_TIMEOUT})
                .invoke('text')
                .should('match', new RegExp(`^1-${PAGE_SIZE} of ${addedTotal}$`));
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
            expect(outsideOf(paths, TEXT_1_PATH), `paths outside ${TEXT_1_PATH}`).to.deep.equal([]);
        });
    });

    it('lists the rows of the node picked in the editorial picker and of the nodes below it', () => {
        historyTotal(SITE_PATH, {path: CONTENT_FOLDER_PATH}).then(folderTotal => {
            expect(folderTotal, `rows of ${CONTENT_FOLDER_PATH}`).to.be.above(0).and.below(total);
            pickContentFolder(CONTENT_FOLDER);
            cy.get(PATH_FILTER).should('have.value', CONTENT_FOLDER_PATH);
            waitForFilteredRows();
            cy.get(TOTAL_ITEMS)
                .invoke('text')
                .should('match', new RegExp(` of ${folderTotal}$`));
            cy.get(cellsOf('Path')).should($cells => {
                const paths = textsOf($cells);
                expect(paths, 'Path cells').to.include(`${CONTENT_FOLDER_PATH}/text-1`);
                expect(outsideOf(paths, CONTENT_FOLDER_PATH), `paths outside ${CONTENT_FOLDER_PATH}`).to.deep.equal([]);
            });
        });
    });

    it('states that a path outside the site is refused', () => {
        cy.get(PATH_FILTER).type('/sites/sh_10{enter}');
        cy.contains(ERROR, `The path must be ${SITE_PATH} or a path below it`, {timeout: LOAD_TIMEOUT}).should(
            'be.visible'
        );
    });

    it('lists the rows of the user keys typed in the user filter', () => {
        totalsOf({userKeys: ['root']}, {userKeys: [AUTHOR.username]}).then(([rootTotal, authorTotal]) => {
            expect(rootTotal, 'rows of root').to.be.above(0);
            expect(authorTotal, 'rows of sh-author').to.be.above(0);
            // The field drops the blanks and the duplicates of the typed list.
            cy.get(USER_FILTER).type(` root ,, ${AUTHOR.username}, root{enter}`);
            cy.get(USER_FILTER).should('have.value', `root, ${AUTHOR.username}`);
            waitForFilteredRows();
            cy.get(TOTAL_ITEMS)
                .invoke('text')
                .should('match', new RegExp(` of ${rootTotal + authorTotal}$`));
            cy.get(cellsOf('User')).should($cells => {
                const users = Cypress._.uniq(textsOf($cells));
                expect(users, 'User cells').not.to.be.empty;
                expect(Cypress._.without(users, 'root', AUTHOR.username), 'other users').to.deep.equal([]);
            });

            // A key matches a whole user name, so the start of a user name matches no row.
            cy.get(USER_FILTER).clear();
            cy.get(USER_FILTER).type('root, sh-auth{enter}');
            cy.get(TOTAL_ITEMS, {timeout: LOAD_TIMEOUT})
                .invoke('text')
                .should('match', new RegExp(` of ${rootTotal}$`));
            cy.get(cellsOf('User')).should($cells => {
                expect(Cypress._.uniq(textsOf($cells)), 'User cells').to.deep.equal(['root']);
            });
        });
    });

    it('lists the rows of the user picked in the jContent user picker', () => {
        historyTotal(SITE_PATH, {userKeys: [AUTHOR.username]}).then(authorTotal => {
            expect(authorTotal, 'rows of sh-author').to.be.above(0).and.below(total);
            cy.get(USER_FILTER).should('have.value', '');

            pickUser(AUTHOR.username);
            cy.get(USER_FILTER).should('have.value', AUTHOR.username);
            waitForFilteredRows();
            cy.get(TOTAL_ITEMS)
                .invoke('text')
                .should('match', new RegExp(` of ${authorTotal}$`));
            cy.get(cellsOf('User')).should($cells => {
                const users = textsOf($cells);
                expect(users, 'User cells').not.to.be.empty;
                expect(Cypress._.uniq(users), 'User cells').to.deep.equal([AUTHOR.username]);
            });

            // The picker opens on the picked users, and Cancel keeps the filter.
            cy.get(USER_PICKER_BUTTON).click();
            cy.get(`${PICKER_SELECTION} [data-sel-role="1-item-selected"]`, {timeout: LOAD_TIMEOUT}).should(
                'be.visible'
            );
            cy.get(`${PICKER} [data-sel-picker-dialog-action="cancel"]`).click();
            cy.get(PICKER).should('not.exist');
            cy.get(USER_FILTER).should('have.value', AUTHOR.username);

            clearField(USER_FILTER);
            cy.get(TOTAL_ITEMS, {timeout: LOAD_TIMEOUT})
                .invoke('text')
                .should('match', new RegExp(`^1-${PAGE_SIZE} of ${total}$`));
            cy.get(USER_FILTER).should('have.value', '');
            cy.get(CLEAR_FILTERS).should('be.disabled');
        });
    });

    it('adds the picked users to the typed user keys, and removes a user unselected in the picker', () => {
        totalsOf({userKeys: ['root']}, {userKeys: [AUTHOR.username]}).then(([rootTotal, authorTotal]) => {
            cy.get(USER_FILTER).type('root{enter}');
            waitForFilteredRows();
            cy.get(TOTAL_ITEMS)
                .invoke('text')
                .should('match', new RegExp(` of ${rootTotal}$`));

            pickUser(AUTHOR.username);
            cy.get(USER_FILTER).should('have.value', `root, ${AUTHOR.username}`);
            cy.get(TOTAL_ITEMS, {timeout: LOAD_TIMEOUT})
                .invoke('text')
                .should('match', new RegExp(` of ${rootTotal + authorTotal}$`));

            // The typed key has no node, so the picker opens on sh-author alone. The picker refuses an empty selection.
            cy.get(USER_PICKER_BUTTON).click();
            cy.get(`${PICKER_SELECTION} [data-sel-role="1-item-selected"]`, {timeout: LOAD_TIMEOUT}).should(
                'be.visible'
            );
            toggleUserInPicker('root', true);
            toggleUserInPicker(AUTHOR.username, false);
            cy.get(`${PICKER_SELECTION} [data-sel-role="1-item-selected"]`).should('be.visible');
            cy.get(`${PICKER} [data-sel-picker-dialog-action="done"]`).click();
            cy.get(PICKER).should('not.exist');
            cy.get(USER_FILTER).should('have.value', 'root');
            cy.get(TOTAL_ITEMS, {timeout: LOAD_TIMEOUT})
                .invoke('text')
                .should('match', new RegExp(` of ${rootTotal}$`));
        });
    });

    it('keeps the page when the picker closes on the same users', () => {
        historyTotal(SITE_PATH, {userKeys: ['root']}).then(rootTotal => {
            expect(rootTotal, 'rows of root, more than one page').to.be.above(PAGE_SIZE);
            pickUser('root');
            waitForFilteredRows();
            cy.get(TOTAL_ITEMS)
                .invoke('text')
                .should('match', new RegExp(`^1-${PAGE_SIZE} of ${rootTotal}$`));
            cy.get(NEXT_PAGE).click();
            cy.get(TOTAL_ITEMS)
                .invoke('text')
                .should('match', new RegExp(`^${PAGE_SIZE + 1}-\\d+ of ${rootTotal}$`));

            cy.get(USER_PICKER_BUTTON).click();
            cy.get(`${PICKER_SELECTION} [data-sel-role="1-item-selected"]`, {timeout: LOAD_TIMEOUT}).should(
                'be.visible'
            );
            cy.get(`${PICKER} [data-sel-picker-dialog-action="done"]`).click();
            cy.get(PICKER).should('not.exist');
            cy.get(TABLE, {timeout: LOAD_TIMEOUT}).should('have.attr', 'aria-busy', 'false');
            cy.get(TOTAL_ITEMS)
                .invoke('text')
                .should('match', new RegExp(`^${PAGE_SIZE + 1}-\\d+ of ${rootTotal}$`));
        });
    });

    it('clears the user filter with the other filters', () => {
        pickUser(AUTHOR.username);
        waitForFilteredRows();
        cy.get(USER_FILTER).should('have.value', AUTHOR.username);

        cy.get(CLEAR_FILTERS).click();
        cy.get(TOTAL_ITEMS, {timeout: LOAD_TIMEOUT})
            .invoke('text')
            .should('match', new RegExp(`^1-${PAGE_SIZE} of ${total}$`));
        cy.get(USER_FILTER).should('have.value', '');
        cy.get(CLEAR_FILTERS).should('be.disabled');
    });

    it('clears every filter', () => {
        cy.get(PATH_FILTER).type(`${TEXT_1_PATH}{enter}`);
        selectActions('Published');
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
