package org.jahia.pm.modules.sitehistory.history;

import org.jahia.utils.DatabaseUtils;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

/**
 * Reads the rows of {@code jahia_contenthistory} that match a {@link HistoryFilter}.
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

    public long count(HistoryFilter filter) throws SQLException {
        HistorySql sql = dialect.countSql(filter);
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql.getText())) {
            statement.setQueryTimeout(QUERY_TIMEOUT_SECONDS);
            bind(statement, sql);
            try (ResultSet resultSet = statement.executeQuery()) {
                return resultSet.next() ? resultSet.getLong(1) : 0;
            }
        }
    }

    /**
     * @return the rows of the page, in the order of the sort
     */
    public List<HistoryRow> page(HistoryFilter filter, HistorySort sort, HistoryPage page) throws SQLException {
        HistorySql sql = dialect.pageSql(filter, sort, page);
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql.getText())) {
            statement.setQueryTimeout(QUERY_TIMEOUT_SECONDS);
            bind(statement, sql);
            List<HistoryRow> rows = new ArrayList<>(page.getLimit());
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    rows.add(toRow(resultSet));
                }
            }
            return rows;
        }
    }

    private static void bind(PreparedStatement statement, HistorySql sql) throws SQLException {
        int index = 0;
        for (Object parameter : sql.getParameters()) {
            statement.setObject(++index, parameter);
        }
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
