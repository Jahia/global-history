package org.jahia.pm.modules.globalhistory.history;

/**
 * The column and the direction of the order of the history rows.
 */
public final class HistorySort {

    /**
     * A column of {@code jahia_contenthistory} that the rows can be sorted by.
     */
    public enum Field {
        DATE("entry_date"),
        USER("user_key"),
        ACTION("entry_action"),
        PATH("entry_path"),
        PROPERTY("property_name"),
        UUID("uuid"),
        MESSAGE("message");

        private final String column;

        Field(String column) {
            this.column = column;
        }

        String getColumn() {
            return column;
        }
    }

    public static final HistorySort NEWEST_FIRST = new HistorySort(Field.DATE, true);

    private final Field field;
    private final boolean descending;

    public HistorySort(Field field, boolean descending) {
        this.field = field;
        this.descending = descending;
    }

    public Field getField() {
        return field;
    }

    public boolean isDescending() {
        return descending;
    }
}
