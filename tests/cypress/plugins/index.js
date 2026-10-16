/// <reference types="cypress" />

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

// Mochawesome writes cypress.json, then cypress_001.json, when overwrite is false.
const RAW_REPORT_FILE_REGEX = /^cypress(?:_\d+)?\.json$/;

const toSuiteName = specRelativePath =>
    path
        .basename(specRelativePath)
        .replace(/\.cy\.[jt]sx?$/i, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_');

const sanitizeRunId = runId => String(runId).replace(/[^a-zA-Z0-9_-]/g, '_');

/**
 * @type {Cypress.PluginConfig}
 */
module.exports = (on, config) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('@jahia/cypress/dist/plugins/registerPlugins').registerPlugins(on, config);

    const runId = sanitizeRunId(
        config.env?.runId || process.env.CYPRESS_RUN_ID || process.env.GITHUB_RUN_ID || Date.now().toString()
    );

    // Renames each raw report after its spec, because the [name] placeholder does not expand in this reporter stack.
    on('after:spec', spec => {
        const reportDir = path.resolve(config.projectRoot, 'results/reports');
        if (!fs.existsSync(reportDir)) {
            return;
        }

        const rawReports = fs
            .readdirSync(reportDir)
            .filter(fileName => RAW_REPORT_FILE_REGEX.test(fileName))
            .map(fileName => ({
                filePath: path.join(reportDir, fileName),
                mtimeMs: fs.statSync(path.join(reportDir, fileName)).mtimeMs
            }))
            .sort((a, b) => b.mtimeMs - a.mtimeMs);

        const baseName = `cypress_${toSuiteName(spec.relative)}_${runId}`;
        for (const report of rawReports) {
            let targetName = `${baseName}.json`;
            let index = 1;

            while (fs.existsSync(path.join(reportDir, targetName))) {
                targetName = `${baseName}_${String(index).padStart(3, '0')}.json`;
                index += 1;
            }

            fs.renameSync(report.filePath, path.join(reportDir, targetName));
        }
    });

    on('task', {});
    return config;
};
