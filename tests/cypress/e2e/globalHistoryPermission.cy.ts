import {createUser, deleteUser, grantRoles} from '@jahia/cypress';
import {EDITOR, SITE_PATH} from '../support/globalHistory';

const TOTAL_COUNT_QUERY = 'graphql/globalHistory/totalCount.graphql';

describe('globalHistory permission', () => {
    before(() => {
        cy.apolloClient();
        deleteUser(EDITOR.username);
        createUser(EDITOR.username, EDITOR.password);
        grantRoles(SITE_PATH, ['editor'], EDITOR.username, 'USER');
    });

    after(() => {
        cy.apolloClient();
        deleteUser(EDITOR.username);
    });

    it('denies the history of gh_1 to an editor of gh_1', () => {
        cy.apolloClient({username: EDITOR.username, password: EDITOR.password})
            .apollo({queryFile: TOTAL_COUNT_QUERY, variables: {path: SITE_PATH}, errorPolicy: 'all'})
            .then(result => {
                const site = result.data?.jcr?.nodeByPath;
                expect(site?.uuid, 'the editor reads the site node').to.be.a('string');
                expect(site.globalHistory, 'globalHistory for the editor').to.be.null;
                const messages = (result.errors ?? []).map(error => error.message).join('\n');
                expect(messages, 'error of globalHistory').to.match(/AccessDenied|permission/i);
            });
    });

    it('serves the history of gh_1 to root', () => {
        cy.apolloClient()
            .apollo({queryFile: TOTAL_COUNT_QUERY, variables: {path: SITE_PATH}, errorPolicy: 'all'})
            .then(result => {
                expect(result.errors, 'errors for root').to.be.undefined;
                expect(result.data?.jcr?.nodeByPath?.globalHistory?.totalCount, 'totalCount for root').to.be.above(0);
            });
    });
});
