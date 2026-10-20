import {addNode, createUser, deleteNode, deleteUser, grantRoles, revokeRoles} from '@jahia/cypress';
import {EDITOR, LOOKALIKE_SITE_KEYS, SERVER_ADMIN, SITE_ADMIN, SITE_PATH, TAB_VIEWER} from '../support/globalHistory';

const TOTAL_COUNT_QUERY = 'graphql/globalHistory/totalCount.graphql';
const PERMISSION_QUERY = 'graphql/globalHistory/permissionCheck.graphql';
const OTHER_SITE_PATH = `/sites/${LOOKALIKE_SITE_KEYS[0]}`;
const TAB_ROLE = 'gh-history-tab';

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

describe('globalHistory permission on another site', () => {
    before(() => {
        cy.apolloClient();
        deleteUser(SITE_ADMIN.username);
        createUser(SITE_ADMIN.username, SITE_ADMIN.password);
        grantRoles(SITE_PATH, ['site-administrator'], SITE_ADMIN.username, 'USER');
        grantRoles(OTHER_SITE_PATH, ['editor'], SITE_ADMIN.username, 'USER');
    });

    after(() => {
        cy.apolloClient();
        deleteUser(SITE_ADMIN.username);
    });

    it('serves the history of gh_1 to a site administrator of gh_1', () => {
        cy.apolloClient({username: SITE_ADMIN.username, password: SITE_ADMIN.password})
            .apollo({queryFile: TOTAL_COUNT_QUERY, variables: {path: SITE_PATH}, errorPolicy: 'all'})
            .then(result => {
                expect(result.errors, 'errors for the site administrator').to.be.undefined;
                expect(result.data?.jcr?.nodeByPath?.globalHistory?.totalCount, 'totalCount of gh_1').to.be.above(0);
            });
    });

    it('denies the history of ghx1 to a site administrator of gh_1 who edits ghx1', () => {
        cy.apolloClient({username: SITE_ADMIN.username, password: SITE_ADMIN.password})
            .apollo({queryFile: TOTAL_COUNT_QUERY, variables: {path: OTHER_SITE_PATH}, errorPolicy: 'all'})
            .then(result => {
                const site = result.data?.jcr?.nodeByPath;
                expect(site?.uuid, 'the site administrator reads the node of ghx1').to.be.a('string');
                expect(site.globalHistory, 'globalHistory of ghx1').to.be.null;
                const messages = (result.errors ?? []).map(error => error.message).join('\n');
                expect(messages, 'error of globalHistory').to.match(/AccessDenied|permission/i);
            });
    });
});

describe('globalHistory permission defaults', () => {
    before(() => {
        cy.apolloClient();
        [TAB_VIEWER, SERVER_ADMIN].forEach(user => {
            deleteUser(user.username);
            createUser(user.username, user.password);
        });
        addNode({
            parentPathOrId: '/roles',
            name: TAB_ROLE,
            primaryNodeType: 'jnt:role',
            properties: [
                {name: 'j:roleGroup', value: 'edit-role'},
                {name: 'j:privilegedAccess', value: 'true'},
                {name: 'j:permissionNames', values: ['jcr:read_default', 'viewHistoryTab']}
            ]
        });
        grantRoles(SITE_PATH, [TAB_ROLE], TAB_VIEWER.username, 'USER');
        grantRoles('/', ['server-administrator'], SERVER_ADMIN.username, 'USER');
    });

    after(() => {
        cy.apolloClient();
        revokeRoles('/', ['server-administrator'], SERVER_ADMIN.username, 'USER');
        [TAB_VIEWER, SERVER_ADMIN].forEach(user => deleteUser(user.username));
        deleteNode(`/roles/${TAB_ROLE}`);
    });

    it('denies the history of gh_1 to a user who holds viewHistoryTab only', () => {
        cy.apolloClient({username: TAB_VIEWER.username, password: TAB_VIEWER.password})
            .apollo({
                queryFile: PERMISSION_QUERY,
                variables: {path: SITE_PATH, permission: 'viewHistoryTab'},
                errorPolicy: 'all'
            })
            .then(result => {
                const site = result.data?.jcr?.nodeByPath;
                expect(site?.hasPermission, 'viewHistoryTab on gh_1').to.be.true;
                expect(site.globalHistory, 'globalHistory for the user').to.be.null;
                const messages = (result.errors ?? []).map(error => error.message).join('\n');
                expect(messages, 'error of globalHistory').to.match(/AccessDenied|permission/i);
            });
    });

    it('serves the history of gh_1 to a server administrator', () => {
        cy.apolloClient({username: SERVER_ADMIN.username, password: SERVER_ADMIN.password})
            .apollo({
                queryFile: PERMISSION_QUERY,
                variables: {path: SITE_PATH, permission: 'viewGlobalHistory'},
                errorPolicy: 'all'
            })
            .then(result => {
                expect(result.errors, 'errors for the server administrator').to.be.undefined;
                const site = result.data?.jcr?.nodeByPath;
                expect(site?.hasPermission, 'viewGlobalHistory on gh_1').to.be.true;
                expect(site.globalHistory?.totalCount, 'totalCount of gh_1').to.be.above(0);
            });
    });
});
