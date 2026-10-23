import {deleteSite, deleteUser} from '@jahia/cypress';
import {ALL_SITE_KEYS, AUTHOR, EDITOR} from '../support/siteHistory';

describe('Site history test suite teardown', () => {
    it('deletes the test sites and the users', () => {
        if (Cypress.env('SITE_HISTORY_KEEP_SITES') === true) {
            cy.log('Skipping the site deletion because SITE_HISTORY_KEEP_SITES=true');
            return;
        }

        ALL_SITE_KEYS.forEach(siteKey => deleteSite(siteKey));
        deleteUser(EDITOR.username);
        deleteUser(AUTHOR.username);
    });
});
