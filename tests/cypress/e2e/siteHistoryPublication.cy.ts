import {publishAndWaitJobEnding, setNodeProperty} from '@jahia/cypress';
import {
    CONTENT_FOLDER_PATH,
    HistoryEntry,
    historyPage,
    MAX_LIMIT,
    nodeUuid,
    waitForAction
} from '../support/siteHistory';

const TEXT_2_PATH = `${CONTENT_FOLDER_PATH}/text-2`;
// A publication writes a row of each property for each published node.
const HIDDEN_PROPERTIES = ['j:lastPublished', 'j:lastPublishedBy'];

const hiddenRows = (entries: HistoryEntry[]) => entries.filter(entry => HIDDEN_PROPERTIES.includes(entry.propertyName));
const isPublishedRowOf = (uuid: string) => (entry: HistoryEntry) => entry.uuid === uuid && entry.action === 'published';

describe('siteHistory publication rows', () => {
    it('lists the published row of a node and no row of j:lastPublished or j:lastPublishedBy', () => {
        setNodeProperty(TEXT_2_PATH, 'text', 'Text 2, edited before its own publication', 'en');
        publishAndWaitJobEnding(TEXT_2_PATH, ['en']);
        nodeUuid(TEXT_2_PATH).then(uuid => {
            waitForAction(TEXT_2_PATH, [uuid], 'published');

            historyPage(TEXT_2_PATH, 0, MAX_LIMIT).then(page => {
                expect(page.entries.filter(isPublishedRowOf(uuid)), 'published rows of text-2').not.to.be.empty;
                expect(hiddenRows(page.entries), 'rows of j:lastPublished and j:lastPublishedBy').to.deep.equal([]);
                expect(page.entries, 'rows read, against totalCount').to.have.length(page.totalCount);
            });

            // Jahia writes the rows of j:lastPublished and j:lastPublishedBy with the actions added and changed.
            historyPage(TEXT_2_PATH, 0, MAX_LIMIT, {filter: {actions: ['added', 'changed']}}).then(page => {
                expect(page.entries, 'added and changed rows of text-2').not.to.be.empty;
                expect(hiddenRows(page.entries), 'rows of j:lastPublished and j:lastPublishedBy').to.deep.equal([]);
                expect(page.entries, 'rows read, against totalCount').to.have.length(page.totalCount);
            });
        });
    });
});
