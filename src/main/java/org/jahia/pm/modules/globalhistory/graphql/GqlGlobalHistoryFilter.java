package org.jahia.pm.modules.globalhistory.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;

import java.util.List;

@GraphQLName("GlobalHistoryFilter")
@GraphQLDescription("History rows that match every field that is set. A null or empty field matches every row")
public class GqlGlobalHistoryFilter {

    @GraphQLField
    @GraphQLDescription("Rows whose action is one of these values, at most 20 values")
    private final List<String> actions;

    @GraphQLField
    @GraphQLDescription("Rows dated at or after this time, in milliseconds since epoch")
    private final Long fromTimestamp;

    @GraphQLField
    @GraphQLDescription("Rows dated before this time, in milliseconds since epoch")
    private final Long beforeTimestamp;

    @GraphQLField
    @GraphQLDescription("Rows of this path and of the paths below it. The path is the node path or a path below it")
    private final String path;

    public GqlGlobalHistoryFilter(@GraphQLName("actions") List<String> actions,
                                  @GraphQLName("fromTimestamp") Long fromTimestamp,
                                  @GraphQLName("beforeTimestamp") Long beforeTimestamp,
                                  @GraphQLName("path") String path) {
        this.actions = actions;
        this.fromTimestamp = fromTimestamp;
        this.beforeTimestamp = beforeTimestamp;
        this.path = path;
    }

    public List<String> getActions() {
        return actions;
    }

    public Long getFromTimestamp() {
        return fromTimestamp;
    }

    public Long getBeforeTimestamp() {
        return beforeTimestamp;
    }

    public String getPath() {
        return path;
    }
}
