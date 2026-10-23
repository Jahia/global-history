package org.jahia.pm.modules.sitehistory.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLTypeExtension;
import org.jahia.modules.graphql.provider.dxm.DataFetchingException;
import org.jahia.modules.graphql.provider.dxm.node.GqlJcrNode;
import org.jahia.pm.modules.sitehistory.history.HistoryRepository;

import javax.jcr.AccessDeniedException;
import javax.jcr.RepositoryException;

@GraphQLTypeExtension(GqlJcrNode.class)
public class SiteHistoryNodeExtension {

    private static final String HISTORY_PERMISSION = "viewSiteHistory";

    private final GqlJcrNode node;

    public SiteHistoryNodeExtension(GqlJcrNode node) {
        this.node = node;
    }

    @GraphQLField
    @GraphQLName("siteHistory")
    @GraphQLDescription("Content history of this node and of every node below it. Requires the 'viewSiteHistory' permission on this node")
    public GqlSiteHistory getSiteHistory() {
        try {
            if (!node.getNode().hasPermission(HISTORY_PERMISSION)) {
                throw new AccessDeniedException("User does not have permission '" + HISTORY_PERMISSION + "' to view history for node " + node.getPath());
            }
        } catch (RepositoryException e) {
            throw new DataFetchingException(e);
        }
        return new GqlSiteHistory(node.getNode(), HistoryRepository.forCurrentDatabase());
    }
}
