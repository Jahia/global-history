package org.jahia.pm.modules.globalhistory.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLTypeExtension;
import org.jahia.modules.graphql.provider.dxm.DataFetchingException;
import org.jahia.modules.graphql.provider.dxm.node.GqlJcrNode;
import org.jahia.pm.modules.globalhistory.history.HistoryRepository;

import javax.jcr.AccessDeniedException;
import javax.jcr.RepositoryException;

@GraphQLTypeExtension(GqlJcrNode.class)
public class GlobalHistoryNodeExtension {

    private static final String HISTORY_PERMISSION = "viewGlobalHistory";

    private final GqlJcrNode node;

    public GlobalHistoryNodeExtension(GqlJcrNode node) {
        this.node = node;
    }

    @GraphQLField
    @GraphQLName("globalHistory")
    @GraphQLDescription("Content history of this node and of every node below it. Requires the 'viewGlobalHistory' permission on this node")
    public GqlGlobalHistory getGlobalHistory() {
        try {
            if (!node.getNode().hasPermission(HISTORY_PERMISSION)) {
                throw new AccessDeniedException("User does not have permission '" + HISTORY_PERMISSION + "' to view history for node " + node.getPath());
            }
        } catch (RepositoryException e) {
            throw new DataFetchingException(e);
        }
        return new GqlGlobalHistory(node.getNode(), HistoryRepository.forCurrentDatabase());
    }
}
