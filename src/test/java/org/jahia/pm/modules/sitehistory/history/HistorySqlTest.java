package org.jahia.pm.modules.sitehistory.history;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import static java.util.Arrays.asList;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.params.provider.Arguments.arguments;

class HistorySqlTest {

    private static final String LIMIT_OFFSET = "LIMIT ? OFFSET ?";
    private static final String OFFSET_FETCH = "OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";
    private static final List<Object> LIMIT_THEN_OFFSET = asList(20, 40);
    private static final List<Object> OFFSET_THEN_LIMIT = asList(40, 20);
    private static final String SCOPE = "/sites/sh_1";
    private static final List<Object> SCOPE_PATTERNS = asList("/sites/sh!_1", "/sites/sh!_1/%");
    private static final String SHOWN_PROPERTY =
            "(property_name IS NULL OR property_name NOT IN ('j:lastPublished', 'j:lastPublishedBy'))";

    static Stream<Arguments> dialects() {
        return Stream.of(
                arguments(HistoryDialect.MYSQL, "entry_path", "LIKE BINARY", LIMIT_OFFSET, LIMIT_THEN_OFFSET),
                arguments(HistoryDialect.DERBY, "entry_path", "LIKE", OFFSET_FETCH, OFFSET_THEN_LIMIT),
                arguments(HistoryDialect.POSTGRESQL, "convert_from(lo_get(entry_path), 'UTF8')", "LIKE", LIMIT_OFFSET, LIMIT_THEN_OFFSET),
                arguments(HistoryDialect.ORACLE, "entry_path", "LIKE", OFFSET_FETCH, OFFSET_THEN_LIMIT),
                arguments(HistoryDialect.MSSQL, "entry_path COLLATE Latin1_General_BIN", "LIKE", OFFSET_FETCH, OFFSET_THEN_LIMIT));
    }

    @ParameterizedTest
    @MethodSource("dialects")
    void dialectWritesTheSqlOfItsVendor(HistoryDialect dialect, String path, String like, String pagination,
            List<Object> paginationParameters) {
        HistoryFilter noFilter = HistoryFilter.of(SCOPE, null, null, null, null, null);
        String condition = path + " " + like + " ? ESCAPE '!'";
        String where = " WHERE (" + condition + " OR " + condition + ") AND " + SHOWN_PROPERTY;

        HistorySql count = dialect.countSql(noFilter);
        assertEquals("SELECT COUNT(*) FROM jahia_contenthistory" + where, count.getText());
        assertEquals(SCOPE_PATTERNS, count.getParameters());

        HistorySql page = dialect.pageSql(noFilter, HistorySort.NEWEST_FIRST, HistoryPage.of(40, 20));
        assertEquals("SELECT id, entry_date, uuid, property_name, " + path + " AS entry_path, entry_action, user_key, message"
                + " FROM jahia_contenthistory" + where + " ORDER BY entry_date DESC, id DESC " + pagination, page.getText());
        List<Object> parameters = new ArrayList<>(SCOPE_PATTERNS);
        parameters.addAll(paginationParameters);
        assertEquals(parameters, page.getParameters());

        HistoryFilter everyFilter = HistoryFilter.of(SCOPE, "/sites/sh_1/contents", asList("created", "", null, "published"),
                asList("root", "sh-author"), 1790805600000L, 1792101600000L);
        HistorySql filteredCount = dialect.countSql(everyFilter);
        assertEquals("SELECT COUNT(*) FROM jahia_contenthistory" + where
                + " AND entry_action IN (?, ?) AND user_key IN (?, ?) AND entry_date >= ? AND entry_date < ?",
                filteredCount.getText());
        assertEquals(asList("/sites/sh!_1/contents", "/sites/sh!_1/contents/%", "created", "published", "root", "sh-author",
                1790805600000L, 1792101600000L), filteredCount.getParameters());
    }

    static Stream<Arguments> sorts() {
        return Stream.of(
                arguments(HistorySort.Field.DATE, false, "entry_date ASC, id ASC"),
                arguments(HistorySort.Field.DATE, true, "entry_date DESC, id DESC"),
                arguments(HistorySort.Field.USER, false, "user_key ASC, entry_date DESC, id DESC"),
                arguments(HistorySort.Field.ACTION, true, "entry_action DESC, entry_date DESC, id DESC"),
                arguments(HistorySort.Field.PROPERTY, false, "property_name ASC, entry_date DESC, id DESC"),
                arguments(HistorySort.Field.UUID, true, "uuid DESC, entry_date DESC, id DESC"),
                arguments(HistorySort.Field.MESSAGE, false, "message ASC, entry_date DESC, id DESC"));
    }

    @ParameterizedTest
    @MethodSource("sorts")
    void sortOrdersByItsColumnThenNewestFirst(HistorySort.Field field, boolean descending, String orderBy) {
        HistorySql page = HistoryDialect.MYSQL.pageSql(HistoryFilter.of(SCOPE, null, null, null, null, null),
                new HistorySort(field, descending), HistoryPage.of(0, 20));
        assertTrue(page.getText().endsWith(" ORDER BY " + orderBy + " " + LIMIT_OFFSET), page.getText());
    }

    static Stream<Arguments> pathSorts() {
        return Stream.of(
                arguments(HistoryDialect.MYSQL, "entry_path"),
                arguments(HistoryDialect.DERBY, "CAST(entry_path AS VARCHAR(32672))"),
                arguments(HistoryDialect.POSTGRESQL, "convert_from(lo_get(entry_path), 'UTF8')"),
                arguments(HistoryDialect.ORACLE, "DBMS_LOB.SUBSTR(entry_path, 1000, 1)"),
                arguments(HistoryDialect.MSSQL, "entry_path"));
    }

    @ParameterizedTest
    @MethodSource("pathSorts")
    void pathSortUsesAnExpressionThatTheDatabaseCanSort(HistoryDialect dialect, String pathSort) {
        HistorySql page = dialect.pageSql(HistoryFilter.of(SCOPE, null, null, null, null, null),
                new HistorySort(HistorySort.Field.PATH, false), HistoryPage.of(0, 20));
        assertTrue(page.getText().contains(" ORDER BY " + pathSort + " ASC, entry_date DESC, id DESC "), page.getText());
    }

    @Test
    void pathFilterReplacesTheScope() {
        assertEquals(asList("/sites/sh!_1/contents/a!_b", "/sites/sh!_1/contents/a!_b/%"),
                HistoryDialect.DERBY.where(HistoryFilter.of(SCOPE, "/sites/sh_1/contents/a_b//", null, null, null, null)).getParameters());
        assertEquals(SCOPE_PATTERNS, HistoryDialect.DERBY.where(HistoryFilter.of("/", SCOPE, null, null, null, null)).getParameters());
    }

    @Test
    void userFilterBindsOneValuePerKey() {
        assertUserCondition(asList("sh-author"), "user_key IN (?)", asList("sh-author"));
        assertUserCondition(asList("root", "sh-author", "jdoe"), "user_key IN (?, ?, ?)", asList("root", "sh-author", "jdoe"));
    }

    @Test
    void userFilterDropsBlankKeysAndDuplicates() {
        assertUserCondition(asList("root", "", null, "  ", "sh-author"), "user_key IN (?, ?)", asList("root", "sh-author"));
        assertUserCondition(asList("sh-author", "root", "sh-author"), "user_key IN (?, ?)", asList("sh-author", "root"));
        HistorySql blankKeysOnly = userWhere(asList("", null, " "));
        assertEquals(userWhere(null).getText(), blankKeysOnly.getText());
        assertEquals(SCOPE_PATTERNS, blankKeysOnly.getParameters());
    }

    @Test
    void escapeLikeEscapesTheWildcardsAndTheEscapeCharacter() {
        assertEquals("/sites/sh!_1", HistoryPaths.escapeLike("/sites/sh_1"));
        assertEquals("100!%", HistoryPaths.escapeLike("100%"));
        assertEquals("a!!b", HistoryPaths.escapeLike("a!b"));
    }

    @Test
    void likePatternsAreTheEscapedPathAndThePathsBelowIt() {
        assertEquals(asList("/sites/sh!_1", "/sites/sh!_1/%"), HistoryPaths.likePatterns("/sites/sh_1"));
    }

    private static HistorySql userWhere(List<String> userKeys) {
        return HistoryDialect.DERBY.where(HistoryFilter.of(SCOPE, null, null, userKeys, null, null));
    }

    private static void assertUserCondition(List<String> userKeys, String condition, List<String> boundKeys) {
        HistorySql where = userWhere(userKeys);
        String pathCondition = "entry_path LIKE ? ESCAPE '!'";
        assertEquals("(" + pathCondition + " OR " + pathCondition + ") AND " + SHOWN_PROPERTY + " AND " + condition, where.getText());
        List<Object> parameters = new ArrayList<>(SCOPE_PATTERNS);
        parameters.addAll(boundKeys);
        assertEquals(parameters, where.getParameters());
    }
}
