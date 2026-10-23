import {addNode, deleteNode} from '@jahia/cypress';
import {
    COLUMNS_STORAGE_KEY,
    CONTENT_FOLDER_PATH,
    DEFAULT_COLUMN_LABELS,
    headerTexts,
    nodeUuid,
    SITE_KEY,
    SITE_PATH,
    waitForAction,
    waitForEntries,
    waitForStableTotal
} from '../support/siteHistory';

const TABLE = '[data-sel-role="site-history-table"]';
const HEADERS = `${TABLE} thead th`;
const ROWS = `${TABLE} tbody tr`;
const LOAD_TIMEOUT = 30000;
const QUERY = 'siteHistoryTable';
const CONTENT_TYPE_LABEL = 'Content type';
const TYPE_CELL = `td:nth-child(${DEFAULT_COLUMN_LABELS.indexOf(CONTENT_TYPE_LABEL) + 1})`;

const TEXT_PATH = `${CONTENT_FOLDER_PATH}/sh-type-text`;
const TRANSLATION_PATH = `${TEXT_PATH}/j:translation_en`;
const DELETED_PATH = `${CONTENT_FOLDER_PATH}/sh-type-deleted`;
// The label of jnt:text in the resource bundles of Jahia.
const TEXT_LABEL = {en: 'Simple text', fr: 'Texte simple'};

type NodeType = {name: string; displayName: string | null; icon: string | null};
type ContentTypeEntry = {path: string; action: string; primaryNodeType: NodeType | null};
type ContentTypesData = {jcr?: {nodeByPath?: {siteHistory?: {entries?: ContentTypeEntry[]}}}};
type Operation = {operationName?: string; variables?: Record<string, unknown>};
type OperationResult = {data?: {jcr?: {nodeByPath?: {siteHistory?: {entries?: Record<string, unknown>[]}}}}};

const textNode = (name: string) => ({
    name,
    primaryNodeType: 'jnt:text',
    properties: [{name: 'text', value: `Text ${name}`, language: 'en'}]
});

// The GraphQL client can batch operations, so a request body is an operation or a list of operations.
const asList = <T>(body: T | T[]): T[] => (Array.isArray(body) ? body : [body]);

const historyOperation = (body: Operation | Operation[]): number =>
    asList(body).findIndex(operation => operation.operationName === QUERY);

const visitHistory = (columns?: Record<string, boolean>) =>
    cy.visit(`/jahia/jcontent/${SITE_KEY}/en/apps/siteHistory`, {
        onBeforeLoad(win) {
            win.localStorage.removeItem(COLUMNS_STORAGE_KEY);
            if (columns) {
                win.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(columns));
            }
        }
    });

// The Path cell holds the full path in a bdi.
const typeCellsOf = (path: string) =>
    cy
        .get(ROWS, {timeout: LOAD_TIMEOUT})
        .filter((_, row) => Cypress.$(row).find('bdi').text() === path)
        .find(TYPE_CELL);

const expectTextType = (path: string) =>
    typeCellsOf(path).should($cells => {
        expect($cells.length, `Content type cells of ${path}`).to.be.greaterThan(0);
        $cells.each((_, cell) => {
            expect(cell.textContent.trim(), `Content type of ${path}`).to.equal(TEXT_LABEL.en);
            const icon = cell.querySelector('img');
            expect(icon?.getAttribute('src'), `icon of ${path}`).to.match(/\/jnt_text\.png$/);
            expect(icon.naturalWidth, `loaded icon of ${path}`).to.be.greaterThan(0);
        });
    });

describe('Site history Content type column', () => {
    before(() => {
        addNode({parentPathOrId: CONTENT_FOLDER_PATH, ...textNode('sh-type-text')});
        addNode({parentPathOrId: CONTENT_FOLDER_PATH, ...textNode('sh-type-deleted')});
        nodeUuid(TEXT_PATH).then(uuid => waitForAction(TEXT_PATH, [uuid], 'created'));
        waitForEntries(
            TEXT_PATH,
            entries => entries.some(entry => entry.path === TRANSLATION_PATH),
            `The history of ${TEXT_PATH} has no row of its translation node`
        );
        nodeUuid(DELETED_PATH).then(uuid => waitForAction(DELETED_PATH, [uuid], 'created'));
        deleteNode(DELETED_PATH);
        waitForStableTotal(SITE_PATH);
    });

    beforeEach(() => {
        cy.login();
    });

    it('gives the type of the content node, in the requested language, and null for a deleted node', () => {
        cy.apollo({
            queryFile: 'graphql/siteHistory/contentTypes.graphql',
            variables: {path: SITE_PATH, language: 'fr'}
        }).then(result => {
            const entries = (result.data as ContentTypesData).jcr.nodeByPath.siteHistory.entries;
            const typesOf = (path: string) =>
                entries.filter(entry => entry.path === path).map(entry => entry.primaryNodeType);

            [TEXT_PATH, TRANSLATION_PATH].forEach(path => {
                const types = typesOf(path);
                expect(types, `types of the rows of ${path}`).not.to.be.empty;
                types.forEach(type => {
                    expect(type?.name, `type name on ${path}`).to.equal('jnt:text');
                    expect(type?.displayName, `French label on ${path}`).to.equal(TEXT_LABEL.fr);
                    expect(type?.icon, `icon on ${path}`).to.match(/\/jnt_text$/);
                });
            });
            const deletedTypes = typesOf(DELETED_PATH);
            expect(deletedTypes, `types of the rows of ${DELETED_PATH}`).not.to.be.empty;
            expect(deletedTypes, `types of the rows of ${DELETED_PATH}`).to.deep.equal(deletedTypes.map(() => null));
        });
    });

    it('shows the label and the icon of a text in the UI language', () => {
        visitHistory();
        cy.contains(HEADERS, new RegExp(`^${CONTENT_TYPE_LABEL}$`), {timeout: LOAD_TIMEOUT}).should('be.visible');
        expectTextType(TEXT_PATH);
    });

    it('shows the type of the content node on a row of its translation node', () => {
        visitHistory();
        expectTextType(TRANSLATION_PATH);
    });

    it('leaves the cell empty for a deleted node', () => {
        visitHistory();
        typeCellsOf(DELETED_PATH).should($cells => {
            expect($cells.length, `Content type cells of ${DELETED_PATH}`).to.be.greaterThan(0);
            $cells.each((_, cell) => {
                expect(cell.textContent.trim(), `Content type of ${DELETED_PATH}`).to.equal('');
                expect(cell.querySelector('img'), `icon of ${DELETED_PATH}`).to.equal(null);
            });
        });
    });

    it('skips the field in the page query when the column is hidden', () => {
        cy.intercept('POST', '**/modules/graphql', request => {
            if (historyOperation(request.body) >= 0) {
                request.alias = 'historyQuery';
            }
        });
        visitHistory({contentType: false});
        cy.wait('@historyQuery', {timeout: LOAD_TIMEOUT}).then(({request, response}) => {
            const index = historyOperation(request.body);
            const variables = asList<Operation>(request.body)[index].variables;
            const entry = asList<OperationResult>(response.body)[index].data.jcr.nodeByPath.siteHistory.entries[0];
            expect(variables.showContentType, 'showContentType').to.equal(false);
            expect(entry, 'first entry without the Content type column').not.to.have.property('primaryNodeType');
            expect(entry, 'first entry without the Content type column').to.have.property('nodeName');
        });
        cy.get(HEADERS, {timeout: LOAD_TIMEOUT}).should($cells => {
            const texts = Cypress.$.makeArray($cells).map(cell => (cell.textContent ?? '').trim());
            expect(texts, 'column headers').to.deep.equal(
                headerTexts(DEFAULT_COLUMN_LABELS.filter(label => label !== CONTENT_TYPE_LABEL))
            );
        });
    });
});
