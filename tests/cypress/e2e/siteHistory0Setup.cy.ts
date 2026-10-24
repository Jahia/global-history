import {
    addNode,
    createSite,
    createUser,
    deleteSite,
    deleteUser,
    grantRoles,
    publishAndWaitJobEnding,
    setNodeProperty
} from '@jahia/cypress';
import {
    ALL_SITE_KEYS,
    AUTHOR,
    AUTHOR_FOLDER,
    AUTHOR_FOLDER_PATH,
    AUTHOR_TEXT_COUNT,
    CONTENT_FOLDER,
    CONTENT_FOLDER_PATH,
    EDITOR,
    LOOKALIKE_SITE_KEYS,
    nodeUuid,
    serverNameOf,
    SITE_PATH,
    TEMPLATE_SET,
    TEXT_1_PATH,
    TEXT_COUNT,
    textNodes,
    waitForAction
} from '../support/siteHistory';

type AddNodeResult = {data?: {jcr?: {addNode?: {uuid: string; addChildrenBatch?: {uuid: string}[]}}}};

// Each text node writes one "added" row, and the page specs need more than 100 "added" rows on sh_1.
// One request per folder of TEXT_COUNT text nodes keeps each request short.
const BULK_FOLDERS = Array.from({length: 9}, (_, index) => `sh-bulk-${index + 1}`);

const addTextFolder = (name: string) =>
    addNode({
        parentPathOrId: `${SITE_PATH}/contents`,
        name,
        primaryNodeType: 'jnt:contentFolder',
        children: textNodes(TEXT_COUNT)
    }).then((result: AddNodeResult) => {
        const folder = result.data?.jcr?.addNode;
        expect(folder?.addChildrenBatch, `text nodes created under ${name}`).to.have.length(TEXT_COUNT);
        const uuids = [folder.uuid, ...folder.addChildrenBatch.map(child => child.uuid)];

        waitForAction(`${SITE_PATH}/contents/${name}`, uuids, 'created');
    });

describe('Site history test suite setup', () => {
    before(() => {
        ALL_SITE_KEYS.forEach(siteKey => deleteSite(siteKey));
        deleteUser(EDITOR.username);
        deleteUser(AUTHOR.username);
    });

    it('creates the sites sh_1, shx1 and sh_10', () => {
        ALL_SITE_KEYS.forEach(siteKey => {
            createSite(siteKey, {templateSet: TEMPLATE_SET, serverName: serverNameOf(siteKey), locale: 'en'});
            nodeUuid(`/sites/${siteKey}/contents`);
        });
    });

    it('creates and publishes the content of sh_1 as root', () => {
        [CONTENT_FOLDER, ...BULK_FOLDERS].forEach(addTextFolder);
        publishAndWaitJobEnding(SITE_PATH, ['en']);
    });

    // The first publication of a whole site writes a "published" row for the site node only.
    // A node edited after it gets its own "published" rows when it is published again.
    it('edits and publishes text-1 of sh_1 again as root', () => {
        setNodeProperty(TEXT_1_PATH, 'text', 'Text 1, edited before its own publication', 'en');
        publishAndWaitJobEnding(CONTENT_FOLDER_PATH, ['en']);
        nodeUuid(TEXT_1_PATH).then(uuid => waitForAction(CONTENT_FOLDER_PATH, [uuid], 'published'));
    });

    it('creates content on sh_1 as the editor sh-author', () => {
        createUser(AUTHOR.username, AUTHOR.password);
        grantRoles(SITE_PATH, ['editor'], AUTHOR.username, 'USER');
        cy.apolloClient({username: AUTHOR.username, password: AUTHOR.password});
        addNode({
            parentPathOrId: `${SITE_PATH}/contents`,
            name: AUTHOR_FOLDER,
            primaryNodeType: 'jnt:contentFolder',
            children: textNodes(AUTHOR_TEXT_COUNT)
        }).then((result: AddNodeResult) => {
            const folder = result.data?.jcr?.addNode;
            expect(folder?.addChildrenBatch, 'text nodes created by sh-author').to.have.length(AUTHOR_TEXT_COUNT);
            const uuids = [folder.uuid, ...folder.addChildrenBatch.map(child => child.uuid)];

            // The editor cannot read the history, so root waits for the rows.
            cy.apolloClient();
            waitForAction(AUTHOR_FOLDER_PATH, uuids, 'created');
        });
    });

    it('creates content on shx1 and sh_10 after the content of sh_1', () => {
        LOOKALIKE_SITE_KEYS.forEach(siteKey => {
            addNode({
                parentPathOrId: `/sites/${siteKey}/contents`,
                name: CONTENT_FOLDER,
                primaryNodeType: 'jnt:text',
                properties: [{name: 'text', value: `Look-alike text of ${siteKey}`, language: 'en'}]
            }).then((result: AddNodeResult) => {
                const uuid = result.data?.jcr?.addNode?.uuid;
                expect(uuid, `text node created on ${siteKey}`).to.be.a('string');
                waitForAction(`/sites/${siteKey}`, [uuid], 'created');
            });
        });
    });
});
