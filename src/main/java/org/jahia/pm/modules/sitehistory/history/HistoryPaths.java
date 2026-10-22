package org.jahia.pm.modules.sitehistory.history;

import java.util.Arrays;
import java.util.List;

/**
 * Path logic of the history table: the LIKE patterns of a scope, and the language of a row.
 */
public final class HistoryPaths {

    public static final char LIKE_ESCAPE = '!';

    private static final String TRANSLATION_PREFIX = "j:translation_";

    private HistoryPaths() {
    }

    /**
     * Escapes the LIKE wildcards {@code %} and {@code _}, and the escape character itself.
     */
    public static String escapeLike(String value) {
        StringBuilder escaped = new StringBuilder(value.length() + 8);
        for (char c : value.toCharArray()) {
            if (c == LIKE_ESCAPE || c == '%' || c == '_') {
                escaped.append(LIKE_ESCAPE);
            }
            escaped.append(c);
        }
        return escaped.toString();
    }

    /**
     * @return the two LIKE patterns of a scope, in bind order: the exact node path, then every path below it
     */
    public static List<String> likePatterns(String nodePath) {
        String below = nodePath.endsWith("/") ? nodePath : nodePath + "/";
        return Arrays.asList(escapeLike(nodePath), escapeLike(below) + "%");
    }

    /**
     * @return the language of the {@code j:translation_<lang>} segment of the path, or {@code null} when it has none
     */
    public static String languageOf(String path) {
        if (path == null) {
            return null;
        }
        String language = null;
        for (String segment : path.split("/")) {
            if (segment.startsWith(TRANSLATION_PREFIX) && segment.length() > TRANSLATION_PREFIX.length()) {
                language = segment.substring(TRANSLATION_PREFIX.length());
            }
        }
        return language;
    }
}
