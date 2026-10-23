import { gql, type ApolloClient, type NormalizedCacheObject } from "@apollo/client";
import { registry } from "@jahia/ui-extender";

// The ancestors that the trees of jContent open, as in GetAncestorsQueryById of jContent.
export const LOCATE_QUERY = gql`
  query siteHistoryLocate($uuid: String!) {
    jcr {
      nodeById(uuid: $uuid) {
        uuid
        workspace
        path
        primaryNodeType {
          name
        }
        parent {
          uuid
          workspace
          path
        }
        site {
          uuid
          workspace
          path
          name
        }
        ancestors(
          fieldFilter: {
            filters: {
              fieldName: "primaryNodeType.name"
              evaluation: AMONG
              values: ["jnt:page", "jnt:folder", "jnt:contentFolder", "jnt:virtualsite", "jnt:virtualsitesFolder"]
            }
          }
        ) {
          uuid
          workspace
          path
          name
          primaryNodeType {
            name
          }
        }
      }
    }
  }
`;

type LocateNode = {
  path: string;
  primaryNodeType: { name: string };
  parent: { uuid: string } | null;
  site: { path: string; name: string };
  ancestors: { path: string; primaryNodeType: { name: string } }[];
};

type LocateData = { jcr: { nodeById: LocateNode | null } | null };

// The accordions of jContent register these functions, and its Locate action calls them in expandTree.
type AccordionItem = {
  key: string;
  canDisplayItem?: (params: { selectionNode: LocateNode }) => boolean;
  getPathForItem?: (node: LocateNode) => string | undefined;
  getViewTypeForItem?: (node: LocateNode) => string | null;
};

type JContentUtils = { buildUrl: (params: { site: string; language: string; mode: string; path: string }) => string };

type GotoAction = { action: (params: { site: string; mode: string; path: string }) => unknown };

export type LocateTarget = {
  site: string;
  mode: string;
  parentPath: string;
  viewType: string | null;
  ancestorPaths: string[];
  nodePath: string;
  href: string | undefined;
};

const toTarget = (node: LocateNode, language: string): LocateTarget | null => {
  const accordions = registry.find({ type: "accordionItem", target: "jcontent" }) as unknown as AccordionItem[];
  const accordion = accordions.find(item => item.canDisplayItem?.({ selectionNode: node }));
  const parentPath = accordion?.getPathForItem?.(node);
  if (!accordion || !parentPath) {
    return null;
  }
  const site = node.site.name;
  const mode = accordion.key;
  const utils = registry.get("jcontent", "utils") as unknown as JContentUtils | undefined;
  const urlbase = globalThis.contextJsParameters?.urlbase ?? "";
  return {
    site,
    mode,
    parentPath,
    viewType: accordion.getViewTypeForItem?.(node) ?? null,
    ancestorPaths: node.ancestors.map(ancestor => ancestor.path),
    nodePath: node.path,
    href: utils && `${urlbase}${utils.buildUrl({ site, language, mode, path: parentPath })}`,
  };
};

/** Gives the place of a node in jContent, or null when the node no longer exists. */
export const resolveLocateTarget = async (
  client: ApolloClient<NormalizedCacheObject>,
  uuid: string,
  language: string,
): Promise<LocateTarget | null> => {
  // An unknown uuid gives an error and a null node, so the errors stay in the result.
  const { data } = await client.query<LocateData>({ query: LOCATE_QUERY, variables: { uuid }, errorPolicy: "all" });
  const node = data?.jcr?.nodeById;
  if (!node) {
    return null;
  }
  // A translation node holds the i18n properties of its parent.
  if (node.primaryNodeType.name === "jnt:translation" && node.parent) {
    return resolveLocateTarget(client, node.parent.uuid, language);
  }
  return toTarget(node, language);
};

/** Opens jContent on the target and selects the node, as the Locate action of jContent does. */
export const goToTarget = (target: LocateTarget): void => {
  const store = globalThis.jahia?.reduxStore;
  const goto = registry.get("redux-action", "jcontentGoto") as unknown as GotoAction | undefined;
  if (!store || !goto) {
    if (target.href) {
      globalThis.location.assign(target.href);
    }
    return;
  }
  store.dispatch(goto.action({ site: target.site, mode: target.mode, path: target.parentPath }));
  if (target.viewType) {
    store.dispatch({ type: "SET_TABLE_VIEW_TYPE", payload: target.viewType });
  }
  store.dispatch({ type: "CM_OPEN_PATHS", payload: target.ancestorPaths });
  // The selection action of jContent changed its type in 3.7.0, and each version ignores the type of the other.
  store.dispatch({ type: "CM_SET_PREVIEW_SELECTION", payload: target.nodePath });
  store.dispatch({ type: "CM_SET_SIDE_PANEL_SELECTION", payload: target.nodePath });
};
