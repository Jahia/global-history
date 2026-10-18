import {
    ALL_COLUMNS_SHOWN,
    COLUMN_LABELS,
    COLUMNS_STORAGE_KEY,
    PAGE_SIZE,
    PAGE_SIZE_OPTIONS,
    SITE_KEY,
    SITE_PATH,
    waitForStableTotal
} from '../support/globalHistory';

const PAGE = '[data-sel-role="site-history"]';
const TABLE = '[data-sel-role="site-history-table"]';
const ROWS = `${TABLE} tbody tr`;
const TOTAL_ITEMS = `${TABLE} [data-testid="pagination-total-items"]`;
const NEXT_PAGE = `${TABLE} [data-testid="pagination-button-next-page"]`;
const ITEMS_PER_PAGE = `${TABLE} [data-testid="pagination-dropdown-items-per-page"]`;
const PAGER = `${TABLE} .moonstone-pagination`;
const LOAD_TIMEOUT = 30000;
// The widest English date of the 'lll' format in Nunito Sans: the widest month, a two-digit day and hour, and AM.
const WIDEST_DATE = 'May 10, 2026 10:00 AM';
// The columns whose cells always hold a text.
const TEXT_COLUMNS = ['Date', 'User', 'Name', 'Path', 'UUID'];

const textsOf = ($elements: JQuery<HTMLElement>) =>
    Cypress.$.makeArray($elements).map(element => (element.textContent ?? '').trim());

const cellsOf = (columnLabel: string) => `${ROWS} td:nth-child(${COLUMN_LABELS.indexOf(columnLabel) + 1})`;

const boxOf = (element: Element): DOMRect => element.getBoundingClientRect();

const middleOf = (box: DOMRect): number => (box.top + box.bottom) / 2;

const styleOf = (element: Element): CSSStyleDeclaration => element.ownerDocument.defaultView.getComputedStyle(element);

const spacingOf = (element: Element, name: string): number =>
    parseFloat(styleOf(element).getPropertyValue(`--moon-spacing-${name}`));

// The client area of the Paper leaves out its scroll bars.
const expectPagerInView = (paper: HTMLElement, when: string) => {
    const pager = paper.querySelector('.moonstone-pagination');
    const top = boxOf(paper).top + paper.clientTop;
    expect(boxOf(pager).top, `top of the pager ${when}`).to.be.at.least(top - 0.5);
    expect(boxOf(pager).bottom, `bottom of the pager ${when}`).to.be.closeTo(top + paper.clientHeight, 0.5);
};

describe('Site history page', () => {
    let total: number;

    before(() => {
        waitForStableTotal(SITE_PATH).then(count => {
            total = count;
        });
    });

    // The page shows every column, so each column gets its checks.
    beforeEach(() => {
        cy.login();
        cy.visit(`/jahia/jcontent/${SITE_KEY}/en/apps/siteHistory`, {
            onBeforeLoad: win => win.localStorage.setItem(COLUMNS_STORAGE_KEY, ALL_COLUMNS_SHOWN)
        });
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

    it('selects 100 rows per page and offers 20, 50 and 100', () => {
        cy.get(`${ITEMS_PER_PAGE} [role="listbox"]`, {timeout: LOAD_TIMEOUT})
            .should('have.attr', 'aria-label', String(PAGE_SIZE))
            .and('have.text', String(PAGE_SIZE));
        cy.get(`${ITEMS_PER_PAGE} [role="listbox"]`).click();
        cy.get(`${ITEMS_PER_PAGE} menu [role="option"]`).should($options => {
            expect(textsOf($options), 'page sizes').to.deep.equal(PAGE_SIZE_OPTIONS);
        });
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

    it('keeps the pager in view and opens the next page on its first row', () => {
        cy.get(ROWS, {timeout: LOAD_TIMEOUT}).should('have.length', PAGE_SIZE);
        cy.get(TABLE).should($paper => {
            const paper = $paper[0];
            expect(paper.scrollHeight, 'height of the rows').to.be.above(paper.clientHeight);
            expect(paper.scrollTop, 'scroll offset on load').to.equal(0);
            expectPagerInView(paper, 'on load');
            const pager = paper.querySelector('.moonstone-pagination');
            expect(boxOf(pager).height, 'height of the pager').to.be.closeTo(spacingOf(pager, 'big'), 0.5);
        });
        cy.get(TABLE).scrollTo('center');
        cy.get(TABLE).should($paper => expectPagerInView($paper[0], 'in the middle of the rows'));
        cy.get(TABLE).scrollTo('bottom');
        cy.get(PAGER).should('be.visible');
        cy.get(NEXT_PAGE).click({scrollBehavior: false});
        cy.get(TOTAL_ITEMS)
            .invoke('text')
            .should('match', new RegExp(`^${PAGE_SIZE + 1}-\\d+ of \\d+$`));
        cy.get(TABLE, {timeout: LOAD_TIMEOUT}).should('have.attr', 'aria-busy', 'false');
        cy.get(TABLE).should($paper => {
            const paper = $paper[0];
            expect(paper.scrollTop, 'scroll offset of page 2').to.equal(0);
            const head = boxOf(paper.querySelector('thead'));
            const firstRow = boxOf(paper.querySelector('tbody tr'));
            expect(firstRow.top, 'top of the first row of page 2').to.be.closeTo(head.bottom, 1);
            expect(firstRow.bottom, 'bottom of the first row of page 2').to.be.at.most(
                boxOf(paper.querySelector('.moonstone-pagination')).top
            );
        });
    });

    it('fits each row in 32px and writes the cells in the caption variant', () => {
        cy.get(ROWS, {timeout: LOAD_TIMEOUT}).should($rows => {
            expect($rows, 'rows').to.have.length(PAGE_SIZE);
            const rowHeight = spacingOf($rows[0], 'large') + spacingOf($rows[0], 'small');
            expect(rowHeight, 'large spacing + small spacing').to.equal(32);
            $rows.each((index, row) => {
                expect(boxOf(row).height, `height of row ${index + 1}`).to.be.closeTo(rowHeight, 1);
            });
        });
        cy.get(TEXT_COLUMNS.map(cellsOf).join(', ')).should($cells => {
            expect($cells, `cells of ${TEXT_COLUMNS.join(', ')}`).to.have.length(PAGE_SIZE * TEXT_COLUMNS.length);
            $cells.each((_, cell) => {
                expect(cell.firstElementChild, `text of "${cell.textContent}"`).to.have.class(
                    'moonstone-variant_caption'
                );
            });
        });
        cy.get(`${ROWS} td > .moonstone-typography`).should($texts => {
            $texts.each((_, text) => {
                expect(styleOf(text).fontSize, `font size of "${text.textContent}"`).to.equal('12px');
            });
        });
        cy.get(`${TABLE} thead th, ${ROWS} td`).should($cells => {
            const cell = $cells.filter('td')[0];
            const cellPadding = styleOf(cell).paddingLeft;
            expect(cellPadding, 'left padding of a cell').to.equal(`${spacingOf(cell, 'small')}px`);
            expect(styleOf($cells.filter('th')[0]).paddingLeft, 'left padding of a header cell').to.equal(cellPadding);
        });
    });

    it('shows every date in full', () => {
        cy.get(cellsOf('Date'), {timeout: LOAD_TIMEOUT}).should($cells => {
            expect($cells, 'Date cells').to.have.length(PAGE_SIZE);
            $cells.each((_, cell) => {
                expect(cell.scrollWidth, `width of "${cell.textContent}"`).to.be.at.most(cell.clientWidth);
            });
            const cell = $cells[0];
            const style = cell.ownerDocument.defaultView.getComputedStyle(cell);
            const context = cell.ownerDocument.createElement('canvas').getContext('2d');
            // The date is the text of a caption inside the cell, so the caption gives the font.
            context.font = cell.ownerDocument.defaultView.getComputedStyle(cell.firstElementChild).font;
            expect(cell.ownerDocument.fonts.check(context.font), `${context.font} loaded`).to.equal(true);
            const room = cell.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
            expect(context.measureText(WIDEST_DATE).width, `width of "${WIDEST_DATE}"`).to.be.at.most(room);
        });
    });

    it('scrolls a long path and opens it on its end', () => {
        cy.get(`${cellsOf('Path')} bdi`, {timeout: LOAD_TIMEOUT}).should($paths => {
            expect($paths, 'Path cells').to.have.length(PAGE_SIZE);
            const path = Cypress._.maxBy($paths.toArray(), element => (element.textContent ?? '').length);
            const scroller = path.parentElement;
            expect(scroller.scrollWidth, `scroll width of ${path.textContent}`).to.be.above(scroller.clientWidth);
            // The scroll bar sits at the bottom of the scroller, so a cell shorter than the scroller cuts it off.
            const cell = boxOf(scroller.closest('td'));
            expect(boxOf(scroller).top, `top of the scroller of ${path.textContent}`).to.be.at.least(cell.top);
            expect(boxOf(scroller).bottom, `bottom of the scroller of ${path.textContent}`).to.be.at.most(cell.bottom);
            expect(path.getBoundingClientRect().right, `right edge of ${path.textContent}`).to.be.closeTo(
                scroller.getBoundingClientRect().right,
                1
            );
            const leadingSlash = path.ownerDocument.createRange();
            leadingSlash.setStart(path.firstChild, 0);
            leadingSlash.setEnd(path.firstChild, 1);
            expect(leadingSlash.getBoundingClientRect().left, 'left edge of the leading slash').to.be.closeTo(
                path.getBoundingClientRect().left,
                1
            );
        });
    });

    it('shows the chip of each action in the middle of its row', () => {
        cy.get(`${cellsOf('Action')} .moonstone-chip`, {timeout: LOAD_TIMEOUT}).should($chips => {
            expect($chips, 'Action chips').to.have.length(PAGE_SIZE);
            $chips.each((_, chip) => {
                const row = boxOf(chip.closest('tr'));
                const box = boxOf(chip);
                expect(box.top, `top of the chip "${chip.textContent}"`).to.be.above(row.top);
                expect(box.bottom, `bottom of the chip "${chip.textContent}"`).to.be.below(row.bottom);
                expect(middleOf(box), `middle of the chip "${chip.textContent}"`).to.be.closeTo(middleOf(row), 1);
                // Moonstone truncates the label inside the chip, and the cell clips a chip wider than the cell.
                const label = chip.querySelector('.moonstone-typography');
                expect(label.scrollWidth, `width of the label "${chip.textContent}"`).to.be.at.most(label.clientWidth);
                expect(box.right, `right edge of the chip "${chip.textContent}"`).to.be.at.most(
                    boxOf(chip.closest('td')).right
                );
            });
        });
    });
});
