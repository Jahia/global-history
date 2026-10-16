package org.jahia.pm.modules.globalhistory.history;

import org.jahia.utils.DatabaseUtils;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

/**
 * Reads the rows of {@code jahia_contenthistory} whose path is a node path or starts below it.
 */
public class HistoryRepository {

    private static final int QUERY_TIMEOUT_SECONDS = 30;

    private final DataSource dataSource;
    private final HistoryDialect dialect;

    public HistoryRepository(DataSource dataSource, HistoryDialect dialect) {
        this.dataSource = dataSource;
        this.dialect = dialect;
    }

    /**
     * @return a repository on the Jahia data source, with the dialect of the configured database
     */
    public static HistoryRepository forCurrentDatabase() {
        return new HistoryRepository(DatabaseUtils.getDatasource(), HistoryDialect.forDatabaseType(DatabaseUtils.getDatabaseType()));
    }

    public long count(String nodePath) throws SQLException {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(dialect.countSql())) {
            statement.setQueryTimeout(QUERY_TIMEOUT_SECONDS);
            bindPatterns(statement, nodePath);
            try (ResultSet resultSet = statement.executeQuery()) {
                return resultSet.next() ? resultSet.getLong(1) : 0;
            }
        }
    }

    /**
     * @return the rows of the page, newest first
     */
    public List<HistoryRow> page(String nodePath, HistoryPage page) throws SQLException {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(dialect.pageSql())) {
            statement.setQueryTimeout(QUERY_TIMEOUT_SECONDS);
            int index = bindPatterns(statement, nodePath);
            for (int value : dialect.paginationParameters(page)) {
                statement.setInt(++index, value);
            }
            List<HistoryRow> rows = new ArrayList<>(page.getLimit());
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    rows.add(toRow(resultSet));
                }
            }
            return rows;
        }
    }

    private static int bindPatterns(PreparedStatement statement, String nodePath) throws SQLException {
        int index = 0;
        for (String pattern : HistoryPaths.likePatterns(nodePath)) {
            statement.setString(++index, pattern);
        }
        return index;
    }

    private static HistoryRow toRow(ResultSet resultSet) throws SQLException {
        String id = resultSet.getString("id");
        long date = resultSet.getLong("entry_date");
        Long entryDate = resultSet.wasNull() ? null : date;
        String uuid = resultSet.getString("uuid");
        String propertyName = resultSet.getString("property_name");
        String path = resultSet.getString("entry_path");
        String action = resultSet.getString("entry_action");
        String userKey = resultSet.getString("user_key");
        String message = resultSet.getString("message");
        return new HistoryRow(id, entryDate, uuid, propertyName, path, action, userKey, message);
    }
}
