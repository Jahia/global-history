package org.jahia.pm.modules.sitehistory.history;

import org.jahia.utils.DatabaseUtils.DatabaseType;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * The SQL of the history queries for one database vendor.
 */
public enum HistoryDialect {

    MYSQL(Sql.PATH, Sql.PATH, Sql.LIKE + " BINARY", Pagination.LIMIT_OFFSET),
    // Derby and Oracle store the path as a CLOB, and neither database sorts a CLOB.
    DERBY(Sql.PATH, "CAST(" + Sql.PATH + " AS VARCHAR(32672))", Sql.LIKE, Pagination.OFFSET_FETCH),
    POSTGRESQL(Sql.POSTGRESQL_PATH, Sql.POSTGRESQL_PATH, Sql.LIKE, Pagination.LIMIT_OFFSET),
    ORACLE(Sql.PATH, "DBMS_LOB.SUBSTR(" + Sql.PATH + ", 1000, 1)", Sql.LIKE, Pagination.OFFSET_FETCH),
    MSSQL(Sql.PATH + " COLLATE Latin1_General_BIN", Sql.PATH, Sql.LIKE, Pagination.OFFSET_FETCH);

    private static final class Sql {
        static final String PATH = "entry_path";
        static final String POSTGRESQL_PATH = "convert_from(lo_get(" + PATH + "), 'UTF8')";
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
    // NOT IN alone drops the rows without a property, such as the published rows.
    private static final String SHOWN_PROPERTY_CONDITION =
            "(property_name IS NULL OR property_name NOT IN ('j:lastPublished', 'j:lastPublishedBy'))";

    private final String pathExpression;
    private final String pathSortExpression;
    private final String likeOperator;
    private final Pagination pagination;

    HistoryDialect(String pathExpression, String pathSortExpression, String likeOperator, Pagination pagination) {
        this.pathExpression = pathExpression;
        this.pathSortExpression = pathSortExpression;
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
     * @return the page query of the rows that match the filter, in the order of the sort; rows with an equal value
     * come newest first
     */
    public HistorySql pageSql(HistoryFilter filter, HistorySort sort, HistoryPage page) {
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
                + " ORDER BY " + orderBy(sort) + " "
                + pagination.clause;
        return new HistorySql(text, parameters);
    }

    private String orderBy(HistorySort sort) {
        String direction = sort.isDescending() ? " DESC" : " ASC";
        HistorySort.Field field = sort.getField();
        if (field == HistorySort.Field.DATE) {
            return "entry_date" + direction + ", id" + direction;
        }
        String column = field == HistorySort.Field.PATH ? pathSortExpression : field.getColumn();
        return column + direction + ", entry_date DESC, id DESC";
    }

    /**
     * @return the condition of the filter, without the {@code WHERE} keyword
     */
    HistorySql where(HistoryFilter filter) {
        List<String> conditions = new ArrayList<>();
        List<Object> parameters = new ArrayList<>(HistoryPaths.likePatterns(filter.getPath()));
        conditions.add(pathCondition());
        conditions.add(SHOWN_PROPERTY_CONDITION);
        if (!filter.getActions().isEmpty()) {
            conditions.add(inCondition("entry_action", filter.getActions().size()));
            parameters.addAll(filter.getActions());
        }
        if (!filter.getUserKeys().isEmpty()) {
            conditions.add(inCondition("user_key", filter.getUserKeys().size()));
            parameters.addAll(filter.getUserKeys());
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

    private static String inCondition(String column, int valueCount) {
        return column + " IN (" + String.join(", ", Collections.nCopies(valueCount, "?")) + ")";
    }

    private String pathCondition() {
        String like = pathExpression + " " + likeOperator + " ? ESCAPE '" + HistoryPaths.LIKE_ESCAPE + "'";
        return "(" + like + " OR " + like + ")";
    }
}
