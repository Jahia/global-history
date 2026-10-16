import {
    CONTENT_FOLDER,
    CONTENT_FOLDER_PATH,
    hasActionForEach,
    HistoryEntry,
    historyPage,
    isInScope,
    LOOKALIKE_SITE_KEYS,
    MAX_LIMIT,
    nodeUuid,
    SITE_PATH,
    TEXT_1_PATH,
    waitForAction,
    waitForEntries
} from '../support/globalHistory';

const TRANSLATION_PATH = `${TEXT_1_PATH}/j:translation_en`;
const TEXT_PROPERTY_PATH = `${TRANSLATION_PATH}/text`;

const outOfScopePaths = (entries: HistoryEntry[], scopePath: string) =>
    entries.filter(entry => !isInScope(entry.path, scopePath)).map(entry => entry.path);

describe('globalHistory scope', () => {
    it('lists the created, added and published rows of the content of gh_1', () => {
        nodeUuid(CONTENT_FOLDER_PATH).then(folderUuid =>
            nodeUuid(TEXT_1_PATH).then(textUuid => {
                const isTextAdded = (entry: HistoryEntry) =>
                    entry.action === 'added' && entry.path === TEXT_PROPERTY_PATH;
                const isTranslationPublished = (entry: HistoryEntry) =>
                    entry.action === 'published' && entry.path === TRANSLATION_PATH;
                const isDone = (entries: HistoryEntry[]) =>
                    hasActionForEach(entries, [folderUuid], 'created') &&
                    hasActionForEach(entries, [textUuid], 'published') &&
                    entries.some(isTranslationPublished) &&
                    entries.some(isTextAdded);

                waitForEntries(
                    SITE_PATH,
                    isDone,
                    `The history of ${SITE_PATH} misses rows of ${CONTENT_FOLDER_PATH}`
                ).then(entries => {
                    const created = entries.find(entry => entry.uuid === folderUuid && entry.action === 'created');
                    expect(created.path, 'path of the created row').to.equal(CONTENT_FOLDER_PATH);
                    expect(created.userKey, 'user of the created row').to.equal('root');
                    expect(created.nodeExists, 'node of the created row exists').to.equal(true);

                    const published = entries.find(entry => entry.uuid === textUuid && entry.action === 'published');
                    expect(published.message, 'message of the published row').to.match(/^default;;live/);
                    expect(published.language, 'language of the published node row').to.equal(null);

                    const publishedTranslation = entries.find(isTranslationPublished);
                    expect(publishedTranslation.language, 'language of the published translation row').to.equal('en');
                    expect(publishedTranslation.nodeName, 'name of the published translation row').to.equal('text-1');

                    const added = entries.find(isTextAdded);
                    expect(added.propertyName, 'property of the added row').to.equal('text');
                    expect(added.language, 'language of the added row').to.equal('en');
                });
            })
        );
    });

    it('leaves out the rows of ghx1 and gh_10', () => {
        const lookalikeUuids: string[] = [];

        LOOKALIKE_SITE_KEYS.forEach(siteKey => {
            const sitePath = `/sites/${siteKey}`;
            nodeUuid(`${sitePath}/contents/${CONTENT_FOLDER}`).then(uuid => {
                lookalikeUuids.push(uuid);
                waitForAction(sitePath, [uuid], 'created').then(entries => {
                    expect(outOfScopePaths(entries, sitePath), `paths outside ${sitePath}`).to.deep.equal([]);
                });
            });
        });

        historyPage(SITE_PATH, 0, MAX_LIMIT).then(page => {
            expect(lookalikeUuids, 'look-alike nodes found').to.have.length(LOOKALIKE_SITE_KEYS.length);
            expect(page.entries, `rows of ${SITE_PATH}`).not.to.be.empty;
            expect(outOfScopePaths(page.entries, SITE_PATH), `paths outside ${SITE_PATH}`).to.deep.equal([]);
            const leaked = page.entries.filter(entry => lookalikeUuids.includes(entry.uuid));
            expect(leaked, 'rows of ghx1 and gh_10').to.deep.equal([]);
        });
    });
});
