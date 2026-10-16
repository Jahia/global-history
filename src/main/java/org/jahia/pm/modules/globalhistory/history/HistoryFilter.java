package org.jahia.pm.modules.globalhistory.history;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * A validated filter of the history rows: a path in the scope, at most 20 actions, and a date range.
 */
public final class HistoryFilter {

    private static final int MAX_ACTIONS = 20;

    private final String path;
    private final List<String> actions;
    private final Long fromTimestamp;
    private final Long beforeTimestamp;

    private HistoryFilter(String path, List<String> actions, Long fromTimestamp, Long beforeTimestamp) {
        this.path = path;
        this.actions = actions;
        this.fromTimestamp = fromTimestamp;
        this.beforeTimestamp = beforeTimestamp;
    }

    /**
     * @param scopePath       the path of the node whose history is read
     * @param path            the scope or a path below it, {@code null} or blank for the scope; trailing slashes are removed
     * @param actions         the actions to keep, {@code null} or empty for every action; null and blank values are dropped
     * @param fromTimestamp   the start date, inclusive, in milliseconds since epoch, {@code null} for no start
     * @param beforeTimestamp the end date, exclusive, in milliseconds since epoch, {@code null} for no end
     * @throws IllegalArgumentException when more than 20 actions remain, or when the path is outside the
     *                                  scope or holds {@code [} or {@code ]}
     */
    public static HistoryFilter of(String scopePath, String path, List<String> actions, Long fromTimestamp,
            Long beforeTimestamp) {
        return new HistoryFilter(effectivePath(scopePath, path), validActions(actions), fromTimestamp, beforeTimestamp);
    }

    private static String effectivePath(String scopePath, String path) {
        if (path == null || path.isBlank()) {
            return scopePath;
        }
        String withoutTrailingSlashes = path.replaceAll("[\\s/]+$", "").trim();
        String normalized = withoutTrailingSlashes.isEmpty() ? "/" : withoutTrailingSlashes;
        String prefix = scopePath.endsWith("/") ? scopePath : scopePath + "/";
        if (!normalized.equals(scopePath) && !normalized.startsWith(prefix)) {
            throw new IllegalArgumentException("path must be " + scopePath + " or a path below it, got " + normalized);
        }
        if (normalized.indexOf('[') >= 0 || normalized.indexOf(']') >= 0) {
            throw new IllegalArgumentException("path must not contain [ or ], got " + normalized);
        }
        return normalized;
    }

    private static List<String> validActions(List<String> actions) {
        if (actions == null) {
            return Collections.emptyList();
        }
        List<String> valid = actions.stream()
                .filter(action -> action != null && !action.isBlank())
                .collect(Collectors.toUnmodifiableList());
        if (valid.size() > MAX_ACTIONS) {
            throw new IllegalArgumentException("actions must hold at most " + MAX_ACTIONS + " values, got " + valid.size());
        }
        return valid;
    }

    /**
     * @return the scope, or the path below it that the filter keeps
     */
    public String getPath() {
        return path;
    }

    /**
     * @return the actions to keep, empty for every action
     */
    public List<String> getActions() {
        return actions;
    }

    public Long getFromTimestamp() {
        return fromTimestamp;
    }

    public Long getBeforeTimestamp() {
        return beforeTimestamp;
    }
}
