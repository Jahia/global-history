package org.jahia.pm.modules.globalhistory.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;

@GraphQLName("GlobalHistorySort")
@GraphQLDescription("The column and the direction of the order of the history rows. Rows with an equal value come newest first")
public class GqlGlobalHistorySort {

    @GraphQLName("GlobalHistorySortField")
    @GraphQLDescription("A column of the history rows that the rows can be sorted by")
    public enum Field {
        @GraphQLDescription("The date of the row")
        DATE,
        @GraphQLDescription("The user key, not the name of the user")
        USER,
        @GraphQLDescription("The action, for example published")
        ACTION,
        @GraphQLDescription("The path of the node")
        PATH,
        @GraphQLDescription("The name of the property, not its label")
        PROPERTY,
        @GraphQLDescription("The identifier of the node")
        UUID,
        @GraphQLDescription("The message of the row")
        MESSAGE
    }

    @GraphQLName("GlobalHistorySortDirection")
    @GraphQLDescription("The direction of the order of the history rows")
    public enum Direction {
        ASC,
        DESC
    }

    @GraphQLField
    @GraphQLNonNull
    @GraphQLDescription("Column to sort by")
    private final Field field;

    @GraphQLField
    @GraphQLNonNull
    @GraphQLDescription("Direction of the sort")
    private final Direction direction;

    public GqlGlobalHistorySort(@GraphQLName("field") Field field, @GraphQLName("direction") Direction direction) {
        this.field = field;
        this.direction = direction;
    }

    public Field getField() {
        return field;
    }

    public Direction getDirection() {
        return direction;
    }
}
