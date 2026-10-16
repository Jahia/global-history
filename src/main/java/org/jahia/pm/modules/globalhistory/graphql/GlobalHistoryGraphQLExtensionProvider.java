package org.jahia.pm.modules.globalhistory.graphql;

import org.jahia.modules.graphql.provider.dxm.DXGraphQLExtensionsProvider;
import org.osgi.service.component.annotations.Component;

import java.util.Collection;
import java.util.Collections;

@Component(service = DXGraphQLExtensionsProvider.class, immediate = true)
public class GlobalHistoryGraphQLExtensionProvider implements DXGraphQLExtensionsProvider {

    @Override
    public Collection<Class<?>> getExtensions() {
        return Collections.singletonList(GlobalHistoryNodeExtension.class);
    }
}
