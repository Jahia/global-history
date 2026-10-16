package org.jahia.pm.modules.globalhistory.graphql;

import org.apache.commons.lang.StringUtils;
import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.services.content.decorator.JCRUserNode;
import org.jahia.services.usermanager.JahiaUserManagerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.jcr.RepositoryException;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Resolves the nodes and the users of one page of history rows, each one once.
 */
class HistoryEntryResolver {

    private static final Logger logger = LoggerFactory.getLogger(HistoryEntryResolver.class);

    private static final String TRANSLATION_NODE_TYPE = "jnt:translation";

    private final JCRSessionWrapper session;
    private final String siteKey;
    private final Map<String, Optional<JCRNodeWrapper>> nodes = new HashMap<>();
    private final Map<String, Optional<GqlGlobalHistoryUser>> users = new HashMap<>();

    HistoryEntryResolver(JCRSessionWrapper session, String siteKey) {
        this.session = session;
        this.siteKey = siteKey;
    }

    /**
     * @return the node of the uuid, its content node for a translation node, or {@code null} when it is deleted or unreadable
     */
    JCRNodeWrapper node(String uuid) {
        if (StringUtils.isEmpty(uuid)) {
            return null;
        }
        return nodes.computeIfAbsent(uuid, this::lookupNode).orElse(null);
    }

    GqlGlobalHistoryUser user(String userKey) {
        if (StringUtils.isBlank(userKey)) {
            return null;
        }
        return users.computeIfAbsent(userKey, this::lookupUser).orElse(null);
    }

    private Optional<JCRNodeWrapper> lookupNode(String uuid) {
        try {
            JCRNodeWrapper node = session.getNodeByIdentifier(uuid);
            return Optional.of(node.isNodeType(TRANSLATION_NODE_TYPE) ? node.getParent() : node);
        } catch (RepositoryException e) {
            logger.debug("Cannot read the node {}", uuid, e);
            return Optional.empty();
        }
    }

    private Optional<GqlGlobalHistoryUser> lookupUser(String userKey) {
        JCRUserNode userNode = JahiaUserManagerService.getInstance().lookupUser(userKey, siteKey, true);
        return userNode != null ? Optional.of(new GqlGlobalHistoryUser(userNode.getJahiaUser())) : Optional.empty();
    }
}
