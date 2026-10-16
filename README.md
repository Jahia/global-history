# Global History

Global History is a Jahia module that lists the content history of a whole site in one paginated table in jContent.

The jContent History tab shows the history of one node. This module reads the same core table, `jahia_contenthistory`, and shows every row whose path is the site path or a path below it. The module stores no data of its own.

## Requirements

- Jahia 8.2.2.0 or later.
- The modules `default`, `graphql-dxm-provider` 3.4.0 or later, and `jcontent`. Jahia 8.2.2.0 and later releases ship these three modules.

## Where to find the page

Open jContent on a site, then open the **Additional** accordion and select **Site history**. The page URL has this form:

```
/jahia/jcontent/<siteKey>/<language>/apps/siteHistory
```

## Permissions

A user needs two permissions on the site node, `/sites/<siteKey>`:

| Permission | What it controls |
|---|---|
| `additionalAccordionAccess` | jContent shows the Additional accordion. |
| `viewHistoryTab` | jContent shows the Site history entry, and the GraphQL field returns the rows. |

The GraphQL field checks `viewHistoryTab` on the node it is called on. A user without the permission gets an access-denied error and no rows. The jContent History tab uses the same permission.

## Columns

The table has 9 columns and shows the newest row first. You can show 20, 50 or 100 rows on a page.

| Column | Content |
|---|---|
| Date | The date of the action, in the date format of the UI language. The module formats dates in English, French and German, and it uses English for any other UI language. |
| User | The first name and the last name of the user, or the user name when the names are empty. |
| Action | The action as a chip, for example Created, Modified, Published or Accessed. An unknown action shows as plain text. |
| Name | The display name of the node and its system name. The cell shows a dash when the node no longer exists or the user cannot read it. |
| Property | The label and the name of the property, on a property row only. |
| Language | The language of a row on a translation node or an i18n property, in upper case, for example `EN`. Other rows show a globe icon. |
| Path | The path of the node at the time of the action. A tooltip shows a long path in full. |
| UUID | The identifier of the node. |
| Message | The workspaces of a publication, for example `default;;live`. |

## GraphQL API

The module adds the field `globalHistory` to the `JCRNode` type. The field returns the rows of the node and of every node below it:

```graphql
query {
    jcr {
        nodeByPath(path: "/sites/digitall") {
            globalHistory {
                totalCount
                entries(offset: 0, limit: 20) {
                    date
                    action
                    path
                    propertyName
                    language
                    userKey
                    message
                }
            }
        }
    }
}
```

- `offset` is 0 or more, and its default is 0. A negative offset returns an error.
- `limit` defaults to 20, and the module clamps it to the range 1 to 100.
- `totalCount` is an exact count of the rows.
- Each SQL query has a timeout of 30 seconds.

## Limits

- A moved node keeps the old path on its old rows. Those rows stay listed under the old path.
- The module filters no row by ACL. A user with `viewHistoryTab` on the site sees every row of the site, including the rows of a node that the user cannot read.
- The table includes the `accessed` rows. Jahia writes one `accessed` row on each read of a file, and guest reads count too.
- Jahia 8.2.4.0 deletes the rows that are older than 13 months. On Jahia 8.2.3, a purge in December keeps 1 year of rows.
- Jahia does not log the actions of the user `system`. A script that runs as `system`, such as a Groovy script, leaves no row.
- Jahia records the `default` workspace only. An edit made in the `live` workspace leaves no row.
- A site that is deleted and created again with the same key shows the rows of the old site until the purge deletes them.
- When a whole site is published for the first time, Jahia writes a `published` row for the site node only. A node that changes later gets its own `published` row when it is published again.
- No database index covers the path column, so each count reads the whole history table. With 2,000,000 rows on MariaDB and Jahia 8.2.4, a count took 1.3 seconds.
- The first page of a site with few rows reads most of the date index. With the same 2,000,000 rows, it took 3.5 seconds. Jahia 8.2.3 and older have no date index.

## Database support

The module reads the table with plain JDBC, and it builds one SQL query for each database vendor.

| Database | Support |
|---|---|
| Derby | First-class. The Jahia Docker image and the Cypress CI use Derby. |
| MariaDB | First-class. |
| MySQL | Best effort. |
| PostgreSQL | Best effort. Each query reads every large object of the path column. |
| Oracle | Best effort. |
| Microsoft SQL Server | Best effort. |

## Build

The build needs Java 17, Maven 3, Node 22 and Yarn 4.13.0. The file `mise.toml` pins these versions.

The settings file `.github/maven.settings.xml` reads the Jahia Nexus credentials from 2 environment variables:

```bash
export NEXUS_USERNAME=<your Nexus user>
export NEXUS_PASSWORD=<your Nexus password>
mvn -s .github/maven.settings.xml clean install
```

The build runs Vite and writes the bundle to `target/global-history-<version>.jar`. If your own `~/.m2/settings.xml` already resolves the Jahia repositories, `mvn clean install` is enough.

To check the frontend code without a full build, run these commands:

```bash
yarn install
yarn lint
yarn tsc --noEmit
```

## Deploy

`deploy.sh` builds the module and sends the bundle to the provisioning API of a Jahia server. The script runs `mvn clean install` without the settings file, so your `~/.m2/settings.xml` must resolve the Jahia repositories. Create a file `.env` at the repository root with 3 variables: `JAHIA_URL`, `JAHIA_USER` and `JAHIA_PASS`. Then run this command:

```bash
./deploy.sh prod deploy
```

`./deploy.sh prod test` deploys the bundle and then runs the Cypress suite.

## Tests

- `mvn clean install` runs one JUnit 5 class, `HistorySqlTest`. The class checks the SQL text of each vendor and the escaped LIKE patterns of a site path.
- `tests/` holds the Cypress suite. The suite creates the sites `gh_1`, `ghx1` and `gh_10`, and it checks the scope, the pagination, the permission and the page.

To run the Cypress suite against a running Jahia, run these commands:

```bash
cd tests
yarn install
JAHIA_URL=http://localhost:8080 SUPER_USER_PASSWORD=<root password> yarn e2e:ci
```

## License

MIT. The file `LICENSE` holds the license text.
