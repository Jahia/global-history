import {addNode, createSite, deleteSite, deleteUser, publishAndWaitJobEnding, setNodeProperty} from '@jahia/cypress';
import {
    ALL_SITE_KEYS,
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
} from '../support/globalHistory';

type AddNodeResult = {data?: {jcr?: {addNode?: {uuid: string; addChildrenBatch?: {uuid: string}[]}}}};

describe('Global history test suite setup', () => {
    before(() => {
        ALL_SITE_KEYS.forEach(siteKey => deleteSite(siteKey));
        deleteUser(EDITOR.username);
    });

    it('creates the sites gh_1, ghx1 and gh_10', () => {
        ALL_SITE_KEYS.forEach(siteKey => {
            createSite(siteKey, {templateSet: TEMPLATE_SET, serverName: serverNameOf(siteKey), locale: 'en'});
            nodeUuid(`/sites/${siteKey}/contents`);
        });
    });

    it('creates and publishes the content of gh_1 as root', () => {
        addNode({
            parentPathOrId: `${SITE_PATH}/contents`,
            name: CONTENT_FOLDER,
            primaryNodeType: 'jnt:contentFolder',
            children: textNodes(TEXT_COUNT)
        }).then((result: AddNodeResult) => {
            const folder = result.data?.jcr?.addNode;
            expect(folder?.addChildrenBatch, 'text nodes created under the folder').to.have.length(TEXT_COUNT);
            const uuids = [folder.uuid, ...folder.addChildrenBatch.map(child => child.uuid)];

            waitForAction(CONTENT_FOLDER_PATH, uuids, 'created');
            publishAndWaitJobEnding(SITE_PATH, ['en']);
        });
    });

    // The first publication of a whole site writes a "published" row for the site node only.
    // A node edited after it gets its own "published" rows when it is published again.
    it('edits and publishes text-1 of gh_1 again as root', () => {
        setNodeProperty(TEXT_1_PATH, 'text', 'Text 1, edited before its own publication', 'en');
        publishAndWaitJobEnding(CONTENT_FOLDER_PATH, ['en']);
        nodeUuid(TEXT_1_PATH).then(uuid => waitForAction(CONTENT_FOLDER_PATH, [uuid], 'published'));
    });

    it('creates content on ghx1 and gh_10 after the content of gh_1', () => {
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
