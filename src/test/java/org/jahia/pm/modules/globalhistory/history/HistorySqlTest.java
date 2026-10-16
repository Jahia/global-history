package org.jahia.pm.modules.globalhistory.history;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.stream.Stream;

import static java.util.Arrays.asList;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.params.provider.Arguments.arguments;

class HistorySqlTest {

    private static final String LIMIT_OFFSET = "LIMIT ? OFFSET ?";
    private static final String OFFSET_FETCH = "OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";
    private static final int[] LIMIT_THEN_OFFSET = {20, 40};
    private static final int[] OFFSET_THEN_LIMIT = {40, 20};

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
    void dialectWritesTheSqlOfItsVendor(HistoryDialect dialect, String path, String like, String pagination, int[] parameters) {
        String condition = path + " " + like + " ? ESCAPE '!'";
        String where = " WHERE (" + condition + " OR " + condition + ")";
        assertEquals("SELECT COUNT(*) FROM jahia_contenthistory" + where, dialect.countSql());
        assertEquals("SELECT id, entry_date, uuid, property_name, " + path + " AS entry_path, entry_action, user_key, message"
                + " FROM jahia_contenthistory" + where + " ORDER BY entry_date DESC, id DESC " + pagination, dialect.pageSql());
        assertArrayEquals(parameters, dialect.paginationParameters(HistoryPage.of(40, 20)));
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
}
