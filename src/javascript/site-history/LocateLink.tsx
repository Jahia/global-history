import { Loader, Search } from "@jahia/moonstone";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { NAMESPACE } from "../i18n.ts";
import { goToTarget, resolveLocateTarget, type LocateTarget } from "./locate.ts";
import styles from "./SiteHistoryApp.module.css";

// A pointer that crosses the table on its way elsewhere sends no query.
const HOVER_DELAY_MS = 150;

type LocateState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "ready"; target: LocateTarget }
  | { status: "missing" };

type LocateLinkProps = Readonly<{ uuid: string; isDeleted: boolean; language: string }>;

const isPlainClick = (event: MouseEvent) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

export const LocateLink = ({ uuid, isDeleted, language }: LocateLinkProps) => {
  const { t } = useTranslation(NAMESPACE);
  const [state, setState] = useState<LocateState>({ status: "idle" });
  const request = useRef<Promise<LocateTarget | null>>();
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const resolve = (): Promise<LocateTarget | null> => {
    const client = globalThis.jahia?.apolloClient;
    if (!client) {
      return Promise.resolve(null);
    }
    if (!request.current) {
      setState({ status: "pending" });
      request.current = resolveLocateTarget(client, uuid, language).then(
        target => {
          setState(target ? { status: "ready", target } : { status: "missing" });
          return target;
        },
        () => {
          // A failed request is not a missing node, so the next hover tries again.
          request.current = undefined;
          setState({ status: "idle" });
          return null;
        },
      );
    }
    return request.current;
  };

  const prefetch = () => {
    if (state.status === "idle") {
      timer.current = setTimeout(resolve, HOVER_DELAY_MS);
    }
  };

  const cancelPrefetch = () => clearTimeout(timer.current);

  const locate = () => {
    cancelPrefetch();
    resolve().then(target => target && goToTarget(target));
  };

  // The Name column loads nodeExists, so a deleted node shows as missing before any hover.
  if (isDeleted || state.status === "missing") {
    return (
        <span
        className={`${styles.locate} ${styles.locateDisabled}`}
        aria-disabled="true"
        title={t("siteHistory.locate.missing")}
        data-sel-role="locate-link"
        data-sel-state="missing"
        >
            <Search/>
        </span>
    );
  }

  const href = state.status === "ready" ? state.target.href : undefined;

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // A middle click or a click with a modifier opens the href in a new tab.
    if (href && !isPlainClick(event)) {
      return;
    }
    event.preventDefault();
    locate();
  };

  // A link without href gets no click from the Enter key.
  const onKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (!href && event.key === "Enter") {
      event.preventDefault();
      locate();
    }
  };

  return (
      <a
      className={styles.locate}
      href={href}
      role="link"
      tabIndex={0}
      aria-label={t("siteHistory.locate.title")}
      aria-busy={state.status === "pending"}
      title={t("siteHistory.locate.title")}
      data-sel-role="locate-link"
      data-sel-state={state.status}
      onMouseEnter={prefetch}
      onMouseLeave={cancelPrefetch}
      onFocus={prefetch}
      onBlur={cancelPrefetch}
      onClick={onClick}
      onKeyDown={onKeyDown}
      >
          {state.status === "pending" ? <Loader size="small"/> : <Search/>}
      </a>
  );
};
