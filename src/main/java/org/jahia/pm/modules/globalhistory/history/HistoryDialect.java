package org.jahia.pm.modules.globalhistory.history;

import org.jahia.utils.DatabaseUtils.DatabaseType;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * The SQL of the history queries for one database vendor.
 */
public enum HistoryDialect {

    MYSQL(Sql.PATH, Sql.LIKE + " BINARY", Pagination.LIMIT_OFFSET),
    DERBY(Sql.PATH, Sql.LIKE, Pagination.OFFSET_FETCH),
    POSTGRESQL("convert_from(lo_get(" + Sql.PATH + "), 'UTF8')", Sql.LIKE, Pagination.LIMIT_OFFSET),
    ORACLE(Sql.PATH, Sql.LIKE, Pagination.OFFSET_FETCH),
    MSSQL(Sql.PATH + " COLLATE Latin1_General_BIN", Sql.LIKE, Pagination.OFFSET_FETCH);

    private static final class Sql {
        static final String PATH = "entry_path";
        static final String LIKE = "LIKE";

        private Sql() {
        }
    }

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
     * @return the count query of the rows that match the filter
     */
    public HistorySql countSql(HistoryFilter filter) {
        HistorySql where = where(filter);
        return new HistorySql("SELECT COUNT(*) FROM " + TABLE + " WHERE " + where.getText(), where.getParameters());
    }

    /**
     * @return the page query of the rows that match the filter, newest first
     */
    public HistorySql pageSql(HistoryFilter filter, HistoryPage page) {
        HistorySql where = where(filter);
        List<Object> parameters = new ArrayList<>(where.getParameters());
        if (pagination == Pagination.LIMIT_OFFSET) {
            parameters.add(page.getLimit());
            parameters.add(page.getOffset());
        } else {
            parameters.add(page.getOffset());
            parameters.add(page.getLimit());
        }
        String text = "SELECT id, entry_date, uuid, property_name, " + pathExpression + " AS entry_path, entry_action, user_key, message"
                + " FROM " + TABLE
                + " WHERE " + where.getText()
                + " ORDER BY entry_date DESC, id DESC "
                + pagination.clause;
        return new HistorySql(text, parameters);
    }

    /**
     * @return the condition of the filter, without the {@code WHERE} keyword
     */
    HistorySql where(HistoryFilter filter) {
        List<String> conditions = new ArrayList<>();
        List<Object> parameters = new ArrayList<>(HistoryPaths.likePatterns(filter.getPath()));
        conditions.add(pathCondition());
        if (!filter.getActions().isEmpty()) {
            conditions.add("entry_action IN (" + String.join(", ", Collections.nCopies(filter.getActions().size(), "?")) + ")");
            parameters.addAll(filter.getActions());
        }
        if (filter.getFromTimestamp() != null) {
            conditions.add("entry_date >= ?");
            parameters.add(filter.getFromTimestamp());
        }
        if (filter.getBeforeTimestamp() != null) {
            conditions.add("entry_date < ?");
            parameters.add(filter.getBeforeTimestamp());
        }
        return new HistorySql(String.join(" AND ", conditions), parameters);
    }

    private String pathCondition() {
        String like = pathExpression + " " + likeOperator + " ? ESCAPE '" + HistoryPaths.LIKE_ESCAPE + "'";
        return "(" + like + " OR " + like + ")";
    }
}
