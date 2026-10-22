package org.jahia.pm.modules.sitehistory.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import org.jahia.data.viewhelper.principal.PrincipalViewHelper;
import org.jahia.services.usermanager.JahiaUser;

@GraphQLName("SiteHistoryUser")
@GraphQLDescription("The names of the user who did the action")
public class GqlSiteHistoryUser {

    private final String username;
    private final String firstname;
    private final String lastname;
    private final String displayName;

    GqlSiteHistoryUser(JahiaUser user) {
        this.username = user.getName();
        this.firstname = user.getProperty("j:firstName");
        this.lastname = user.getProperty("j:lastName");
        this.displayName = PrincipalViewHelper.getFullName(user);
    }

    @GraphQLField
    @GraphQLName("username")
    @GraphQLDescription("The user name")
    public String getUsername() {
        return username;
    }

    @GraphQLField
    @GraphQLName("firstname")
    @GraphQLDescription("The first name of the user")
    public String getFirstname() {
        return firstname;
    }

    @GraphQLField
    @GraphQLName("lastname")
    @GraphQLDescription("The last name of the user")
    public String getLastname() {
        return lastname;
    }

    @GraphQLField
    @GraphQLName("displayName")
    @GraphQLDescription("The first and last names of the user, or the displayable name when both are empty")
    public String getDisplayName() {
        return displayName;
    }
}
