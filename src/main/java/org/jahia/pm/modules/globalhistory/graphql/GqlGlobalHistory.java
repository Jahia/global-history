package org.jahia.pm.modules.globalhistory.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;
import org.jahia.api.Constants;
import org.jahia.modules.graphql.provider.dxm.DataFetchingException;
import org.jahia.modules.graphql.provider.dxm.node.GqlJcrWrongInputException;
import org.jahia.pm.modules.globalhistory.history.HistoryPage;
import org.jahia.pm.modules.globalhistory.history.HistoryRepository;
import org.jahia.pm.modules.globalhistory.history.HistoryRow;
import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRSessionFactory;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.services.content.decorator.JCRSiteNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.jcr.RepositoryException;
import java.sql.SQLException;
import java.util.List;
import java.util.stream.Collectors;

@GraphQLName("GlobalHistory")
@GraphQLDescription("Content history rows whose path is the path of a node or a path below it")
public class GqlGlobalHistory {

    private static final Logger logger = LoggerFactory.getLogger(GqlGlobalHistory.class);

    private final JCRNodeWrapper node;
    private final HistoryRepository repository;

    public GqlGlobalHistory(JCRNodeWrapper node, HistoryRepository repository) {
        this.node = node;
        this.repository = repository;
    }

    @GraphQLField
    @GraphQLName("totalCount")
    @GraphQLNonNull
    @GraphQLDescription("Number of history rows in the scope")
    public int getTotalCount() {
        try {
            return (int) Math.min(repository.count(node.getPath()), Integer.MAX_VALUE);
        } catch (SQLException e) {
            throw readFailure(e);
        }
    }

    @GraphQLField
    @GraphQLName("entries")
    @GraphQLDescription("One page of history rows, newest first")
    public List<GqlGlobalHistoryEntry> getEntries(
            @GraphQLName("offset") @GraphQLDescription("Number of rows to skip, 0 or more (default: 0)") Integer offset,
            @GraphQLName("limit") @GraphQLDescription("Number of rows to return, clamped to 1..100 (default: 20)") Integer limit) {
        HistoryPage page;
        try {
            page = HistoryPage.of(offset, limit);
        } catch (IllegalArgumentException e) {
            throw new GqlJcrWrongInputException(e.getMessage(), e);
        }
        List<HistoryRow> rows;
        try {
            rows = repository.page(node.getPath(), page);
        } catch (SQLException e) {
            throw readFailure(e);
        }
        HistoryEntryResolver resolver = new HistoryEntryResolver(editSession(), siteKey());
        return rows.stream().map(row -> new GqlGlobalHistoryEntry(row, resolver)).collect(Collectors.toList());
    }

    private static JCRSessionWrapper editSession() {
        try {
            return JCRSessionFactory.getInstance().getCurrentUserSession(Constants.EDIT_WORKSPACE);
        } catch (RepositoryException e) {
            throw new DataFetchingException(e);
        }
    }

    private String siteKey() {
        try {
            JCRSiteNode site = node.getResolveSite();
            return site != null ? site.getSiteKey() : null;
        } catch (RepositoryException e) {
            logger.debug("Cannot resolve the site of {}", node.getPath(), e);
            return null;
        }
    }

    private DataFetchingException readFailure(SQLException e) {
        logger.error("Cannot read the content history of {}", node.getPath(), e);
        return new DataFetchingException("Cannot read the content history", e);
    }
}
