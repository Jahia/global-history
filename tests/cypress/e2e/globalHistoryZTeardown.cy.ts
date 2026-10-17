import {deleteSite, deleteUser} from '@jahia/cypress';
import {ALL_SITE_KEYS, AUTHOR, EDITOR} from '../support/globalHistory';

describe('Global history test suite teardown', () => {
    it('deletes the test sites and the users', () => {
        if (Cypress.env('GLOBAL_HISTORY_KEEP_SITES') === true) {
            cy.log('Skipping the site deletion because GLOBAL_HISTORY_KEEP_SITES=true');
            return;
        }

        ALL_SITE_KEYS.forEach(siteKey => deleteSite(siteKey));
        deleteUser(EDITOR.username);
        deleteUser(AUTHOR.username);
    });
});
