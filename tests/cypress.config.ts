import {defineConfig} from 'cypress';

export default defineConfig({
    chromeWebSecurity: false,
    defaultCommandTimeout: 2000,
    video: true,
    reporter: 'cypress-multi-reporters',
    reporterOptions: {
        configFile: 'reporter-config.json'
    },
    screenshotsFolder: './results/screenshots',
    videosFolder: './results/videos',
    viewportWidth: 1600,
    viewportHeight: 1000,
    watchForFileChanges: false,
    e2e: {
        setupNodeEvents(on, config) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            require('cypress-terminal-report/src/installLogsPrinter')(on);
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            return require('./cypress/plugins/index.js')(on, config);
        },
        specPattern: [
            'cypress/e2e/globalHistory0Setup.cy.ts',
            'cypress/e2e/globalHistoryScope.cy.ts',
            'cypress/e2e/globalHistoryPagination.cy.ts',
            'cypress/e2e/globalHistoryPermission.cy.ts',
            'cypress/e2e/globalHistoryPage.cy.ts',
            'cypress/e2e/globalHistoryZTeardown.cy.ts'
        ],
        excludeSpecPattern: '*.ignore.ts',
        baseUrl: process.env.CYPRESS_BASE_URL || process.env.JAHIA_URL || 'http://jahia:8080'
    }
});
