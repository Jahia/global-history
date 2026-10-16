import { Clock } from "@jahia/moonstone/dist/icons";
import { registry } from "@jahia/ui-extender";
import { lazy, Suspense } from "react";
import { i18n, NAMESPACE } from "./i18n.ts";

const SiteHistoryApp = lazy(() => import("./site-history/SiteHistoryApp.tsx"));

type RouteProps = { match?: { params?: { siteKey?: string } } };

const siteKeyOf = (props: RouteProps): string =>
  props?.match?.params?.siteKey ?? window.jahia?.reduxStore?.getState().site ?? "";

export default function () {
  registry.add("callback", "global-history", {
    targets: ["jahiaApp-init:50"],
    callback: () => {
      i18n.loadNamespaces(NAMESPACE);

      registry.add("adminRoute", "siteHistory", {
        targets: ["jcontent:60"],
        icon: <Clock/>,
        label: "global-history:siteHistory.nav",
        isSelectable: true,
        requiredPermission: "viewHistoryTab",
        render: (props: RouteProps) => {
          const siteKey = siteKeyOf(props);
          return (
              <Suspense fallback={null}>
                  <SiteHistoryApp key={siteKey} siteKey={siteKey}/>
              </Suspense>
          );
        },
      });
    },
  });
}
