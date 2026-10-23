package org.jahia.pm.modules.sitehistory.history;

/**
 * One row of the {@code jahia_contenthistory} table.
 */
public final class HistoryRow {

    private final String id;
    private final Long date;
    private final String uuid;
    private final String propertyName;
    private final String path;
    private final String action;
    private final String userKey;
    private final String message;

    @SuppressWarnings("java:S107")
    public HistoryRow(String id, Long date, String uuid, String propertyName, String path, String action, String userKey,
            String message) {
        this.id = id;
        this.date = date;
        this.uuid = uuid;
        this.propertyName = propertyName;
        this.path = path;
        this.action = action;
        this.userKey = userKey;
        this.message = message;
    }

    public String getId() {
        return id;
    }

    /**
     * @return the entry date in milliseconds since epoch, or {@code null}
     */
    public Long getDate() {
        return date;
    }

    public String getUuid() {
        return uuid;
    }

    public String getPropertyName() {
        return propertyName;
    }

    public String getPath() {
        return path;
    }

    public String getAction() {
        return action;
    }

    public String getUserKey() {
        return userKey;
    }

    public String getMessage() {
        return message;
    }
}
