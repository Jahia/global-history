# CLAUDE.md

## Build

```bash
yarn install                  # Frontend dependencies
yarn lint                     # ESLint
yarn tsc --noEmit             # Type check of src/javascript
mvn -s .github/maven.settings.xml clean install   # Vite build, JUnit 5 tests, target/global-history-*.jar
```

The Maven settings file reads `NEXUS_USERNAME` and `NEXUS_PASSWORD` from the environment. The file `mise.toml` pins Java temurin-17, Node 22, Yarn 4.13.0 and Maven 3.

## Deploy

`deploy.sh` reads `JAHIA_URL`, `JAHIA_USER` and `JAHIA_PASS` from `.env` at the repository root.

```bash
./deploy.sh prod deploy       # Build, then install the bundle through the provisioning API
./deploy.sh dev deploy        # Same, with the Maven profile dev
./deploy.sh prod test         # Deploy, then run the Cypress suite
```

## Test

```bash
cd tests && yarn install
cd tests && yarn lint && yarn typecheck
cd tests && JAHIA_URL=http://localhost:8080 SUPER_USER_PASSWORD=<root password> yarn e2e:ci
cd tests && yarn e2e:debug    # Interactive Cypress runner
```

The suite runs its specs in the order of `specPattern` in `tests/cypress.config.ts`. `globalHistory0Setup.cy.ts` creates the sites `gh_1`, `ghx1` and `gh_10`, and `globalHistoryZTeardown.cy.ts` deletes them. Run a single spec together with these two specs.
