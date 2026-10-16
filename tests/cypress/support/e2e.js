// ***********************************************************
// Support file — loaded automatically before every test file.
// ***********************************************************

import './commands';
import 'cypress-real-events/support';
import addContext from 'mochawesome/addContext';

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('cypress-terminal-report/src/installLogsCollector')();
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('@jahia/cypress/dist/support/registerSupport').registerSupport();

Cypress.on('uncaught:exception', err => {
    Cypress.log({name: 'uncaught', message: err.message});
    return false;
});

if (Cypress.browser.family === 'chromium') {
    Cypress.automation('remote:debugger:protocol', {
        command: 'Network.enable',
        params: {}
    });
    Cypress.automation('remote:debugger:protocol', {
        command: 'Network.setCacheDisabled',
        params: {cacheDisabled: true}
    });
}

Cypress.on('test:after:run', (test, runnable) => {
    let videoName = Cypress.spec.relative;
    videoName = videoName.replace('/.cy.*', '').replace('cypress/e2e/', '');
    const videoUrl = 'videos/' + videoName + '.mp4';
    addContext({test}, videoUrl);
    if (test.state === 'failed') {
        const screenshot = `screenshots/${Cypress.spec.relative.replace('cypress/e2e/', '')}/${
            runnable.parent.title
        } -- ${test.title} (failed).png`;
        addContext({test}, screenshot);
    }
});
