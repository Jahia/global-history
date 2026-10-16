package org.jahia.pm.modules.globalhistory.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;
import org.apache.commons.lang.StringEscapeUtils;
import org.apache.commons.lang.StringUtils;
import org.jahia.data.templates.JahiaTemplatesPackage;
import org.jahia.modules.graphql.provider.dxm.DataFetchingException;
import org.jahia.modules.graphql.provider.dxm.node.NodeHelper;
import org.jahia.pm.modules.globalhistory.history.HistoryPaths;
import org.jahia.pm.modules.globalhistory.history.HistoryRow;
import org.jahia.registries.ServicesRegistry;
import org.jahia.services.content.JCRContentUtils;
import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.decorator.JCRSiteNode;
import org.jahia.services.content.nodetypes.ExtendedItemDefinition;
import org.jahia.services.content.nodetypes.ExtendedNodeType;
import org.jahia.services.content.nodetypes.ExtendedPropertyDefinition;
import org.jahia.settings.SettingsBean;
import org.jahia.utils.LanguageCodeConverters;
import org.jahia.utils.i18n.Messages;
import org.osgi.framework.Bundle;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.jcr.ItemNotFoundException;
import javax.jcr.RepositoryException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@GraphQLName("GlobalHistoryEntry")
@GraphQLDescription("One row of the content history")
public class GqlGlobalHistoryEntry {

    private static final Logger logger = LoggerFactory.getLogger(GqlGlobalHistoryEntry.class);

    private static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSXXX").withZone(ZoneOffset.UTC);

    private final HistoryRow row;
    private final HistoryEntryResolver resolver;

    GqlGlobalHistoryEntry(HistoryRow row, HistoryEntryResolver resolver) {
        this.row = row;
        this.resolver = resolver;
    }

    @GraphQLField
    @GraphQLName("id")
    @GraphQLDescription("The identifier of the history row")
    public String getId() {
        return row.getId();
    }

    @GraphQLField
    @GraphQLName("date")
    @GraphQLDescription("The date of the event in ISO 8601 format, in UTC")
    public String getDate() {
        return toIsoDate(row.getDate());
    }

    @GraphQLField
    @GraphQLName("timestamp")
    @GraphQLDescription("The date of the event in milliseconds since epoch")
    public Long getTimestamp() {
        return row.getDate();
    }

    @GraphQLField
    @GraphQLName("uuid")
    @GraphQLDescription("The UUID of the node. For a property row, the node that holds the property")
    public String getUuid() {
        return row.getUuid();
    }

    @GraphQLField
    @GraphQLName("path")
    @GraphQLDescription("The path at the time of the event")
    public String getPath() {
        return row.getPath();
    }

    @GraphQLField
    @GraphQLName("action")
    @GraphQLDescription("The action, for example created, changed, published or deleted")
    public String getAction() {
        return row.getAction();
    }

    @GraphQLField
    @GraphQLName("propertyName")
    @GraphQLDescription("The property name, on added, changed and removed rows only")
    public String getPropertyName() {
        return row.getPropertyName();
    }

    @GraphQLField
    @GraphQLName("userKey")
    @GraphQLDescription("The name of the user who did the action")
    public String getUserKey() {
        return row.getUserKey();
    }

    @GraphQLField
    @GraphQLName("message")
    @GraphQLDescription("The message of the row, '<source workspace>;;<target workspace>[;;comment]' on a published row")
    public String getMessage() {
        return row.getMessage();
    }

    @GraphQLField
    @GraphQLName("user")
    @GraphQLDescription("The user who did the action, as a site user or a global user, or null when the user no longer exists")
    public GqlGlobalHistoryUser getUser() {
        return resolver.user(row.getUserKey());
    }

    @GraphQLField
    @GraphQLName("language")
    @GraphQLDescription("The language of the j:translation_<lang> segment of the path, or null")
    public String getLanguage() {
        return HistoryPaths.languageOf(row.getPath());
    }

    @GraphQLField
    @GraphQLName("nodeExists")
    @GraphQLDescription("Whether the node still exists and the current user can read it. When false, every node field is null")
    public Boolean getNodeExists() {
        return node() != null;
    }

    @GraphQLField
    @GraphQLName("nodeName")
    @GraphQLDescription("The system name of the node. For a translation node, the name of its content node")
    public String getNodeName() {
        JCRNodeWrapper node = node();
        return node != null ? node.getName() : null;
    }

    @GraphQLField
    @GraphQLName("nodeNameDisplay")
    @GraphQLDescription("The display name of the node in a language")
    public String getNodeNameDisplay(@GraphQLName("language") @GraphQLNonNull @GraphQLDescription("Language code of the display name") String language) {
        JCRNodeWrapper node = node();
        if (node == null) {
            return null;
        }
        try {
            JCRNodeWrapper localizedNode = NodeHelper.getNodeInLanguage(node, language);
            return localizedNode != null ? localizedNode.getDisplayableName() : null;
        } catch (ItemNotFoundException e) {
            return null;
        } catch (RepositoryException e) {
            throw new DataFetchingException(e);
        }
    }

    @GraphQLField
    @GraphQLName("nodeType")
    @GraphQLDescription("The primary node type of the node")
    public String getNodeType() {
        JCRNodeWrapper node = node();
        if (node == null) {
            return null;
        }
        try {
            return node.getPrimaryNodeTypeName();
        } catch (RepositoryException e) {
            throw new DataFetchingException(e);
        }
    }

    @GraphQLField
    @GraphQLName("propertyNameDisplay")
    @GraphQLDescription("The label of the property in a language, or the property name when no label is found")
    public String getPropertyNameDisplay(@GraphQLName("language") @GraphQLNonNull @GraphQLDescription("Language code of the label") String language) {
        String propertyName = row.getPropertyName();
        if (StringUtils.isBlank(propertyName)) {
            return null;
        }
        JCRNodeWrapper node = node();
        if (node == null) {
            return propertyName;
        }
        try {
            ExtendedPropertyDefinition propertyDefinition = node.getApplicablePropertyDefinition(propertyName);
            if (propertyDefinition == null) {
                return propertyName;
            }
            Locale uiLocale = LanguageCodeConverters.languageCodeToLocale(language);
            JCRSiteNode site = node.getResolveSite();
            String label = labelOf(propertyDefinition, node.getPrimaryNodeType(), uiLocale, site, null);
            label = labelOf(propertyDefinition, propertyDefinition.getDeclaringNodeType(), uiLocale, site, label);
            ExtendedItemDefinition overriddenDefinition = propertyDefinition.getOverridenDefinition();
            if (overriddenDefinition != null) {
                label = labelOf(overriddenDefinition, overriddenDefinition.getDeclaringNodeType(), uiLocale, site, label);
            }
            return StringUtils.isEmpty(label) ? JCRContentUtils.replaceColon(propertyDefinition.getName()) : label;
        } catch (RepositoryException e) {
            logger.debug("Cannot resolve the label of {} on node {}", propertyName, row.getUuid(), e);
            return propertyName;
        }
    }

    static String toIsoDate(Long timestamp) {
        return timestamp != null ? ISO_DATE.format(Instant.ofEpochMilli(timestamp)) : null;
    }

    private JCRNodeWrapper node() {
        return resolver.node(row.getUuid());
    }

    private static String labelOf(ExtendedItemDefinition definition, ExtendedNodeType nodeType, Locale locale, JCRSiteNode site,
            String currentLabel) {
        if (!StringUtils.isEmpty(currentLabel) || definition == null || nodeType == null) {
            return currentLabel;
        }
        String resolved = resolveResourceKey(moduleIdOf(nodeType), definition.getResourceBundleKey(nodeType), locale, site);
        return StringUtils.isEmpty(resolved) ? currentLabel : StringEscapeUtils.unescapeHtml(resolved);
    }

    private static String moduleIdOf(ExtendedNodeType nodeType) {
        JahiaTemplatesPackage templatePackage = nodeType.getTemplatePackage();
        Bundle bundle = templatePackage != null ? templatePackage.getBundle() : null;
        return bundle != null ? bundle.getSymbolicName() : null;
    }

    private static String resolveResourceKey(String moduleId, String key, Locale locale, JCRSiteNode site) {
        if (StringUtils.isEmpty(key)) {
            return key;
        }
        String value = site != null ? Messages.get(null, site.getTemplatePackage(), key, locale, StringUtils.EMPTY) : StringUtils.EMPTY;
        if (StringUtils.isEmpty(value) && moduleId != null) {
            JahiaTemplatesPackage module = ServicesRegistry.getInstance().getJahiaTemplateManagerService().getTemplatePackageRegistry().lookupById(moduleId);
            if (module != null) {
                value = Messages.get(null, module, key, locale, StringUtils.EMPTY);
            }
        }
        return SettingsBean.getInstance().replaceBySubsitutor(value);
    }
}
