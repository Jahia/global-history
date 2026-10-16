package org.jahia.pm.modules.globalhistory.history;

/**
 * A validated page request: an offset of 0 or more, and a limit between 1 and {@link #MAX_LIMIT}.
 */
public final class HistoryPage {

    public static final int DEFAULT_LIMIT = 20;
    public static final int MAX_LIMIT = 100;

    private final int offset;
    private final int limit;

    private HistoryPage(int offset, int limit) {
        this.offset = offset;
        this.limit = limit;
    }

    /**
     * @param offset the number of rows to skip, {@code null} for 0
     * @param limit  the number of rows to return, {@code null} for {@link #DEFAULT_LIMIT}, clamped to 1..{@link #MAX_LIMIT}
     * @throws IllegalArgumentException when the offset is negative
     */
    public static HistoryPage of(Integer offset, Integer limit) {
        int start = offset == null ? 0 : offset;
        if (start < 0) {
            throw new IllegalArgumentException("offset must be 0 or more, got " + start);
        }
        int size = limit == null ? DEFAULT_LIMIT : Math.max(1, Math.min(limit, MAX_LIMIT));
        return new HistoryPage(start, size);
    }

    public int getOffset() {
        return offset;
    }

    public int getLimit() {
        return limit;
    }
}
