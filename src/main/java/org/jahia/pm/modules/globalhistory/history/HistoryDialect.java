package org.jahia.pm.modules.globalhistory.history;

import org.jahia.utils.DatabaseUtils.DatabaseType;

/**
 * The SQL of the history queries for one database vendor.
 */
public enum HistoryDialect {

    MYSQL("entry_path", "LIKE BINARY", Pagination.LIMIT_OFFSET),
    DERBY("entry_path", "LIKE", Pagination.OFFSET_FETCH),
    POSTGRESQL("convert_from(lo_get(entry_path), 'UTF8')", "LIKE", Pagination.LIMIT_OFFSET),
    ORACLE("entry_path", "LIKE", Pagination.OFFSET_FETCH),
    MSSQL("entry_path COLLATE Latin1_General_BIN", "LIKE", Pagination.OFFSET_FETCH);

    private enum Pagination {
        LIMIT_OFFSET("LIMIT ? OFFSET ?"),
        OFFSET_FETCH("OFFSET ? ROWS FETCH NEXT ? ROWS ONLY");

        private final String clause;

        Pagination(String clause) {
            this.clause = clause;
        }
    }

    private static final String TABLE = "jahia_contenthistory";

    private final String pathExpression;
    private final String likeOperator;
    private final Pagination pagination;

    HistoryDialect(String pathExpression, String likeOperator, Pagination pagination) {
        this.pathExpression = pathExpression;
        this.likeOperator = likeOperator;
        this.pagination = pagination;
    }

    public static HistoryDialect forDatabaseType(DatabaseType databaseType) {
        switch (databaseType) {
            case mysql:
            case mariadb:
                return MYSQL;
            case derby:
                return DERBY;
            case postgresql:
                return POSTGRESQL;
            case oracle:
                return ORACLE;
            case mssql:
                return MSSQL;
            default:
                throw new IllegalArgumentException("Unsupported database type: " + databaseType);
        }
    }

    /**
     * @return the count query, which takes the two patterns of {@link HistoryPaths#likePatterns(String)}
     */
    public String countSql() {
        return "SELECT COUNT(*) FROM " + TABLE + " WHERE " + pathCondition();
    }

    /**
     * @return the page query, which takes the two patterns of {@link HistoryPaths#likePatterns(String)},
     * then the values of {@link #paginationParameters(HistoryPage)}
     */
    public String pageSql() {
        return "SELECT id, entry_date, uuid, property_name, " + pathExpression + " AS entry_path, entry_action, user_key, message"
                + " FROM " + TABLE
                + " WHERE " + pathCondition()
                + " ORDER BY entry_date DESC, id DESC "
                + pagination.clause;
    }

    /**
     * @return the offset and the limit of the page, in the order of the pagination clause
     */
    public int[] paginationParameters(HistoryPage page) {
        if (pagination == Pagination.LIMIT_OFFSET) {
            return new int[]{page.getLimit(), page.getOffset()};
        }
        return new int[]{page.getOffset(), page.getLimit()};
    }

    private String pathCondition() {
        String like = pathExpression + " " + likeOperator + " ? ESCAPE '" + HistoryPaths.LIKE_ESCAPE + "'";
        return "(" + like + " OR " + like + ")";
    }
}
