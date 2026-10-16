import { useQuery, type ApolloError } from "@apollo/client";
import { Banner, DataTable, EmptyData, Header, LayoutContent, Loader, Paper } from "@jahia/moonstone";
import { useEffect, useMemo, useState } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { i18n, NAMESPACE } from "../i18n.ts";
import { buildColumns, toRow } from "./columns.tsx";
import { SITE_HISTORY_QUERY, type HistoryEntry, type SiteHistoryData, type SiteHistoryVariables } from "./siteHistory.gql.ts";
import styles from "./SiteHistoryApp.module.css";

const ITEMS_PER_PAGE_OPTIONS = [20, 50, 100];

const isAccessDenied = (error: ApolloError): boolean =>
  error.graphQLErrors.some(e => /AccessDenied|permission/i.test(e.message ?? ""));

type SiteHistoryProps = Readonly<{ siteKey: string }>;

const SiteHistory = ({ siteKey }: SiteHistoryProps) => {
  const { t } = useTranslation(NAMESPACE);
  const uiLanguage = globalThis.contextJsParameters?.uilang ?? "en";
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE_OPTIONS[0]);

  const { data, previousData, loading, error } = useQuery<SiteHistoryData, SiteHistoryVariables>(SITE_HISTORY_QUERY, {
    variables: {
      path: `/sites/${siteKey}`,
      uiLanguage,
      offset: (currentPage - 1) * itemsPerPage,
      limit: itemsPerPage,
    },
    fetchPolicy: "network-only",
    client: globalThis.jahia?.apolloClient,
    skip: !siteKey,
  });

  const shown = data ?? (loading ? previousData : undefined);
  const site = shown?.jcr?.nodeByPath;
  const totalItems = site?.globalHistory?.totalCount ?? previousData?.jcr?.nodeByPath?.globalHistory?.totalCount ?? 0;
  const entries = site?.globalHistory?.entries;

  const columns = useMemo(() => buildColumns(t), [t]);
  const rows = useMemo(
    () => (entries ?? []).filter((e): e is HistoryEntry => e !== null).map(e => toRow(e, uiLanguage)),
    [entries, uiLanguage],
  );

  const isPastLastPage = !loading && !error && shown !== undefined && rows.length === 0 && currentPage > 1;
  useEffect(() => {
    if (isPastLastPage) {
      setCurrentPage(1);
    }
  }, [isPastLastPage]);

  const siteName = site?.displayName || siteKey;

  const isFirstLoad = !error && !shown && loading;

  let content;
  if (error) {
    content = (
        <Banner title={t("siteHistory.errorTitle")} variant="danger" role="alert" data-sel-role="site-history-error">
            {isAccessDenied(error) ? t("siteHistory.accessDenied") : t("siteHistory.error")}
        </Banner>
    );
  } else if (isFirstLoad) {
    content = null;
  } else if (rows.length === 0) {
    content = <EmptyData message={t("siteHistory.empty")} data-sel-role="site-history-empty"/>;
  } else {
    content = (
        <div className={styles.tableArea}>
            <Paper hasPadding={false} className={styles.tableWrapper} aria-busy={loading} data-sel-role="site-history-table">
                <DataTable
          enablePagination
          primaryKey="id"
          data={rows}
          columns={columns}
          enableSorting={false}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          itemsPerPageOptions={ITEMS_PER_PAGE_OPTIONS}
          totalItems={totalItems}
          i18n={{
            itemsPerPage: t("siteHistory.pagination.itemsPerPage"),
            of: t("siteHistory.pagination.of"),
          }}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={value => {
            setItemsPerPage(value);
            setCurrentPage(1);
          }}
        />
            </Paper>
            {loading && (
            <div className={styles.overlay}>
                <Loader size="big"/>
            </div>
        )}
        </div>
    );
  }

  return (
      <LayoutContent
      hasPadding
      className={styles.layout}
      isLoading={isFirstLoad}
      data-sel-role="site-history"
      header={<Header title={t("siteHistory.title", { siteName })}/>}
      >
          {content}
      </LayoutContent>
  );
};

const SiteHistoryApp = ({ siteKey }: SiteHistoryProps) => (
    <I18nextProvider i18n={i18n} defaultNS={NAMESPACE}>
        <SiteHistory siteKey={siteKey}/>
    </I18nextProvider>
);

export default SiteHistoryApp;
