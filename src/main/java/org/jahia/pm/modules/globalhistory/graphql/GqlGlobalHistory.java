package org.jahia.pm.modules.globalhistory.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;
import org.jahia.api.Constants;
import org.jahia.modules.graphql.provider.dxm.DataFetchingException;
import org.jahia.modules.graphql.provider.dxm.node.GqlJcrWrongInputException;
import org.jahia.pm.modules.globalhistory.history.HistoryFilter;
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
import java.util.function.Supplier;
import java.util.stream.Collectors;

@GraphQLName("GlobalHistory")
@GraphQLDescription("Content history rows whose path is the path of a node or a path below it")
public class GqlGlobalHistory {

    private static final Logger logger = LoggerFactory.getLogger(GqlGlobalHistory.class);
    private static final String FILTER_DESCRIPTION = "Rows to keep, null for every row in the scope";

    private final JCRNodeWrapper node;
    private final HistoryRepository repository;

    public GqlGlobalHistory(JCRNodeWrapper node, HistoryRepository repository) {
        this.node = node;
        this.repository = repository;
    }

    @GraphQLField
    @GraphQLName("totalCount")
    @GraphQLNonNull
    @GraphQLDescription("Number of history rows in the scope that match the filter")
    public int getTotalCount(@GraphQLName("filter") @GraphQLDescription(FILTER_DESCRIPTION) GqlGlobalHistoryFilter filter) {
        HistoryFilter historyFilter = validInput(() -> historyFilter(filter));
        try {
            return (int) Math.min(repository.count(historyFilter), Integer.MAX_VALUE);
        } catch (SQLException e) {
            throw readFailure(e);
        }
    }

    @GraphQLField
    @GraphQLName("entries")
    @GraphQLDescription("One page of the history rows that match the filter, newest first")
    public List<GqlGlobalHistoryEntry> getEntries(
            @GraphQLName("offset") @GraphQLDescription("Number of rows to skip, 0 or more (default: 0)") Integer offset,
            @GraphQLName("limit") @GraphQLDescription("Number of rows to return, clamped to 1..100 (default: 20)") Integer limit,
            @GraphQLName("filter") @GraphQLDescription(FILTER_DESCRIPTION) GqlGlobalHistoryFilter filter) {
        HistoryPage page = validInput(() -> HistoryPage.of(offset, limit));
        HistoryFilter historyFilter = validInput(() -> historyFilter(filter));
        List<HistoryRow> rows;
        try {
            rows = repository.page(historyFilter, page);
        } catch (SQLException e) {
            throw readFailure(e);
        }
        HistoryEntryResolver resolver = new HistoryEntryResolver(editSession(), siteKey());
        return rows.stream().map(row -> new GqlGlobalHistoryEntry(row, resolver)).collect(Collectors.toList());
    }

    private HistoryFilter historyFilter(GqlGlobalHistoryFilter filter) {
        if (filter == null) {
            return HistoryFilter.of(node.getPath(), null, null, null, null, null);
        }
        return HistoryFilter.of(node.getPath(), filter.getPath(), filter.getActions(), filter.getUserKeys(),
                filter.getFromTimestamp(), filter.getBeforeTimestamp());
    }

    private static <T> T validInput(Supplier<T> input) {
        try {
            return input.get();
        } catch (IllegalArgumentException e) {
            throw new GqlJcrWrongInputException(e.getMessage(), e);
        }
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
