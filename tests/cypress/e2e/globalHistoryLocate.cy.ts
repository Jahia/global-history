import {addNode, deleteNode, uploadFile} from '@jahia/cypress';
import {
    COLUMNS_STORAGE_KEY,
    CONTENT_FOLDER_PATH,
    nodeUuid,
    SITE_KEY,
    SITE_PATH,
    waitForAction,
    waitForStableTotal
} from '../support/globalHistory';

const TABLE = '[data-sel-role="site-history-table"]';
const ROWS = `${TABLE} tbody tr`;
const LINK = '[data-sel-role="locate-link"]';
const JCONTENT_ROWS = '[data-cm-role="table-content-list"] [data-cm-role="table-content-list-row"]';
const LOAD_TIMEOUT = 30000;
const LOCATE_QUERY = 'globalHistoryLocate';

const AREA_PATH = `${SITE_PATH}/home/gh-locate-area`;
const PAGE_TEXT_PATH = `${AREA_PATH}/gh-locate-text`;
const FOLDER_TEXT_PATH = `${CONTENT_FOLDER_PATH}/gh-locate-text`;
const FILE_NAME = 'gh-locate.txt';
const FILE_PATH = `${SITE_PATH}/files/${FILE_NAME}`;
const DELETED_PATH = `${CONTENT_FOLDER_PATH}/gh-locate-deleted`;

type Operation = {operationName?: string};

// The GraphQL client can batch operations, so a request body is an operation or a list of operations.
const isLocateQuery = (body: Operation | Operation[]): boolean =>
    (Array.isArray(body) ? body : [body]).some(operation => operation.operationName === LOCATE_QUERY);

const textNode = (name: string) => ({
    name,
    primaryNodeType: 'jnt:text',
    properties: [{name: 'text', value: `Text ${name}`, language: 'en'}]
});

// The Path cell holds the full path in a bdi, and the newest row of a node comes first.
const linkOf = (path: string) =>
    cy
        .get(ROWS, {timeout: LOAD_TIMEOUT})
        .filter((_, row) => Cypress.$(row).find('bdi').text() === path)
        .first()
        .find(LINK);

const visitHistory = (columns?: Record<string, boolean>) =>
    cy.visit(`/jahia/jcontent/${SITE_KEY}/en/apps/siteHistory`, {
        onBeforeLoad(win) {
            win.localStorage.removeItem(COLUMNS_STORAGE_KEY);
            if (columns) {
                win.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(columns));
            }
        }
    });

const jcontentState = () => cy.window().its('jahia.reduxStore').invoke('getState').its('jcontent');

// The selection of jContent changed its key in 3.7.0, so the state holds one of the two keys.
const expectSelection = (path: string) =>
    jcontentState().should(state => {
        expect(state.sidePanelSelection ?? state.previewSelection, 'selected node').to.equal(path);
    });

// The computed style of the rows of the jContent table, of their cells and of the content of the cells.
const STYLE_PROPERTIES = [
    'display',
    'flex-wrap',
    'flex-direction',
    'align-items',
    'height',
    'padding-top',
    'padding-left',
    'font-family',
    'font-size',
    'line-height',
    'color',
    'background-color',
    'border-bottom-width',
    'border-bottom-color'
];

const tableStyles = (): Cypress.Chainable<string[]> =>
    cy.get(JCONTENT_ROWS, {timeout: LOAD_TIMEOUT}).then($rows =>
        $rows
            .toArray()
            .flatMap(row => [row, ...Array.from(row.querySelectorAll('td, td *'))])
            .map(element => {
                const style = element.ownerDocument.defaultView.getComputedStyle(element);
                return STYLE_PROPERTIES.map(property => style.getPropertyValue(property)).join('|');
            })
    );

// A click on an accordion of jContent dispatches this action, and the page stays loaded.
const goTo = (mode: string, path: string) =>
    cy
        .window()
        .its('jahia')
        .then(jahia => {
            const goto = jahia.uiExtender.registry.get('redux-action', 'jcontentGoto');
            jahia.reduxStore.dispatch(goto.action({site: SITE_KEY, mode, path}));
        });

describe('Site history Locate link', () => {
    before(() => {
        addNode({
            parentPathOrId: `${SITE_PATH}/home`,
            name: 'gh-locate-area',
            primaryNodeType: 'jnt:contentList',
            children: [textNode('gh-locate-text')]
        });
        addNode({parentPathOrId: CONTENT_FOLDER_PATH, ...textNode('gh-locate-text')});
        uploadFile('files/locate.txt', `${SITE_PATH}/files`, FILE_NAME, 'text/plain');
        addNode({parentPathOrId: CONTENT_FOLDER_PATH, ...textNode('gh-locate-deleted')});

        [PAGE_TEXT_PATH, FOLDER_TEXT_PATH, FILE_PATH, DELETED_PATH].forEach(path =>
            nodeUuid(path).then(uuid => waitForAction(path, [uuid], 'created'))
        );
        deleteNode(DELETED_PATH);
        waitForStableTotal(SITE_PATH);
    });

    beforeEach(() => {
        cy.login();
    });

    it('sends no query on load, and one query per node on hover', () => {
        let locateQueries = 0;
        cy.intercept('POST', '**/modules/graphql', request => {
            if (isLocateQuery(request.body)) {
                locateQueries += 1;
                request.alias = 'locateQuery';
            }
        });
        visitHistory();
        linkOf(FOLDER_TEXT_PATH).should('have.attr', 'data-sel-state', 'idle').and('not.have.attr', 'href');
        cy.then(() => expect(locateQueries, 'Locate queries on load').to.equal(0));

        linkOf(FOLDER_TEXT_PATH).trigger('mouseover');
        cy.wait('@locateQuery', {timeout: LOAD_TIMEOUT});
        linkOf(FOLDER_TEXT_PATH)
            .should('have.attr', 'data-sel-state', 'ready')
            .and('have.attr', 'href', `/jahia/jcontent/${SITE_KEY}/en/content-folders/contents/gh-content`);

        // A resolved link sends no query, so the next query comes from the hover of another node.
        linkOf(FOLDER_TEXT_PATH).trigger('mouseout').trigger('mouseover');
        linkOf(PAGE_TEXT_PATH).trigger('mouseover');
        cy.wait('@locateQuery', {timeout: LOAD_TIMEOUT});
        cy.then(() => expect(locateQueries, 'Locate queries after a second hover and another node').to.equal(2));
    });

    it('opens the content folder of a text and selects the text', () => {
        visitHistory();
        linkOf(FOLDER_TEXT_PATH).trigger('mouseover').should('have.attr', 'data-sel-state', 'ready');
        linkOf(FOLDER_TEXT_PATH).click();
        cy.location('pathname', {timeout: LOAD_TIMEOUT}).should(
            'equal',
            `/jahia/jcontent/${SITE_KEY}/en/content-folders/contents/gh-content`
        );
        expectSelection(FOLDER_TEXT_PATH);
        jcontentState().its('openPaths').should('include', CONTENT_FOLDER_PATH);
    });

    it('leaves the style of the jContent table as a fresh page shows it', () => {
        cy.visit(`/jahia/jcontent/${SITE_KEY}/en/content-folders/contents/gh-content`);
        tableStyles().then(fresh => {
            goTo('apps', '/siteHistory');
            cy.get(ROWS, {timeout: LOAD_TIMEOUT}).should('have.length.greaterThan', 0);
            cy.document().its('documentElement').should('have.attr', 'data-globhis-moonstone');
            goTo('content-folders', CONTENT_FOLDER_PATH);
            cy.get(TABLE).should('not.exist');
            cy.document().its('documentElement').should('not.have.attr', 'data-globhis-moonstone');
            tableStyles().should('deep.equal', fresh);
        });
    });

    it('opens the page of a text in a page on a click before any hover delay', () => {
        visitHistory();
        linkOf(PAGE_TEXT_PATH).should('have.attr', 'data-sel-state', 'idle').click();
        cy.location('pathname', {timeout: LOAD_TIMEOUT}).should('equal', `/jahia/jcontent/${SITE_KEY}/en/pages/home`);
        expectSelection(PAGE_TEXT_PATH);
    });

    it('opens the media folder of a file and selects the file', () => {
        visitHistory();
        linkOf(FILE_PATH)
            .trigger('mouseover')
            .should('have.attr', 'href', `/jahia/jcontent/${SITE_KEY}/en/media/files`);
        linkOf(FILE_PATH).click();
        cy.location('pathname', {timeout: LOAD_TIMEOUT}).should('equal', `/jahia/jcontent/${SITE_KEY}/en/media/files`);
        expectSelection(FILE_PATH);
    });

    it('disables the link of a deleted node at once when the Name column is shown', () => {
        visitHistory();
        linkOf(DELETED_PATH)
            .should('have.attr', 'data-sel-state', 'missing')
            .and('have.attr', 'aria-disabled', 'true')
            .and('have.attr', 'title', 'This content no longer exists')
            .and('not.have.attr', 'href');
    });

    it('disables the link of a deleted node after a hover when the Name column is hidden', () => {
        visitHistory({name: false});
        linkOf(DELETED_PATH).should('have.attr', 'data-sel-state', 'idle').trigger('mouseover');
        linkOf(DELETED_PATH).should('have.attr', 'data-sel-state', 'missing');
        linkOf(DELETED_PATH).click();
        cy.location('pathname').should('equal', `/jahia/jcontent/${SITE_KEY}/en/apps/siteHistory`);
    });
});
