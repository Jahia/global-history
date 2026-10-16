package org.jahia.pm.modules.globalhistory.history;

import java.util.List;

/**
 * The text of a SQL statement and its parameter values, in bind order.
 */
public final class HistorySql {

    private final String text;
    private final List<Object> parameters;

    HistorySql(String text, List<Object> parameters) {
        this.text = text;
        this.parameters = List.copyOf(parameters);
    }

    public String getText() {
        return text;
    }

    public List<Object> getParameters() {
        return parameters;
    }
}
