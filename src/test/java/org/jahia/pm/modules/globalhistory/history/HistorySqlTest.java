package org.jahia.pm.modules.globalhistory.history;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import static java.util.Arrays.asList;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.params.provider.Arguments.arguments;

class HistorySqlTest {

    private static final String LIMIT_OFFSET = "LIMIT ? OFFSET ?";
    private static final String OFFSET_FETCH = "OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";
    private static final List<Object> LIMIT_THEN_OFFSET = asList(20, 40);
    private static final List<Object> OFFSET_THEN_LIMIT = asList(40, 20);
    private static final String SCOPE = "/sites/gh_1";
    private static final List<Object> SCOPE_PATTERNS = asList("/sites/gh!_1", "/sites/gh!_1/%");

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
        String where = " WHERE (" + condition + " OR " + condition + ")";

        HistorySql count = dialect.countSql(noFilter);
        assertEquals("SELECT COUNT(*) FROM jahia_contenthistory" + where, count.getText());
        assertEquals(SCOPE_PATTERNS, count.getParameters());

        HistorySql page = dialect.pageSql(noFilter, HistoryPage.of(40, 20));
        assertEquals("SELECT id, entry_date, uuid, property_name, " + path + " AS entry_path, entry_action, user_key, message"
                + " FROM jahia_contenthistory" + where + " ORDER BY entry_date DESC, id DESC " + pagination, page.getText());
        List<Object> parameters = new ArrayList<>(SCOPE_PATTERNS);
        parameters.addAll(paginationParameters);
        assertEquals(parameters, page.getParameters());

        HistoryFilter everyFilter = HistoryFilter.of(SCOPE, "/sites/gh_1/contents", asList("created", "", null, "published"),
                asList("root", "gh-author"), 1790805600000L, 1792101600000L);
        HistorySql filteredCount = dialect.countSql(everyFilter);
        assertEquals("SELECT COUNT(*) FROM jahia_contenthistory" + where
                + " AND entry_action IN (?, ?) AND user_key IN (?, ?) AND entry_date >= ? AND entry_date < ?",
                filteredCount.getText());
        assertEquals(asList("/sites/gh!_1/contents", "/sites/gh!_1/contents/%", "created", "published", "root", "gh-author",
                1790805600000L, 1792101600000L), filteredCount.getParameters());
    }

    @Test
    void pathFilterReplacesTheScope() {
        assertEquals(asList("/sites/gh!_1/contents/a!_b", "/sites/gh!_1/contents/a!_b/%"),
                HistoryDialect.DERBY.where(HistoryFilter.of(SCOPE, "/sites/gh_1/contents/a_b//", null, null, null, null)).getParameters());
        assertEquals(SCOPE_PATTERNS, HistoryDialect.DERBY.where(HistoryFilter.of("/", SCOPE, null, null, null, null)).getParameters());
    }

    @Test
    void userFilterBindsOneValuePerKey() {
        assertUserCondition(asList("gh-author"), "user_key IN (?)", asList("gh-author"));
        assertUserCondition(asList("root", "gh-author", "jdoe"), "user_key IN (?, ?, ?)", asList("root", "gh-author", "jdoe"));
    }

    @Test
    void userFilterDropsBlankKeysAndDuplicates() {
        assertUserCondition(asList("root", "", null, "  ", "gh-author"), "user_key IN (?, ?)", asList("root", "gh-author"));
        assertUserCondition(asList("gh-author", "root", "gh-author"), "user_key IN (?, ?)", asList("gh-author", "root"));
        HistorySql blankKeysOnly = userWhere(asList("", null, " "));
        assertEquals(userWhere(null).getText(), blankKeysOnly.getText());
        assertEquals(SCOPE_PATTERNS, blankKeysOnly.getParameters());
    }

    @Test
    void escapeLikeEscapesTheWildcardsAndTheEscapeCharacter() {
        assertEquals("/sites/gh!_1", HistoryPaths.escapeLike("/sites/gh_1"));
        assertEquals("100!%", HistoryPaths.escapeLike("100%"));
        assertEquals("a!!b", HistoryPaths.escapeLike("a!b"));
    }

    @Test
    void likePatternsAreTheEscapedPathAndThePathsBelowIt() {
        assertEquals(asList("/sites/gh!_1", "/sites/gh!_1/%"), HistoryPaths.likePatterns("/sites/gh_1"));
    }

    private static HistorySql userWhere(List<String> userKeys) {
        return HistoryDialect.DERBY.where(HistoryFilter.of(SCOPE, null, null, userKeys, null, null));
    }

    private static void assertUserCondition(List<String> userKeys, String condition, List<String> boundKeys) {
        HistorySql where = userWhere(userKeys);
        String pathCondition = "entry_path LIKE ? ESCAPE '!'";
        assertEquals("(" + pathCondition + " OR " + pathCondition + ") AND " + condition, where.getText());
        List<Object> parameters = new ArrayList<>(SCOPE_PATTERNS);
        parameters.addAll(boundKeys);
        assertEquals(parameters, where.getParameters());
    }
}
