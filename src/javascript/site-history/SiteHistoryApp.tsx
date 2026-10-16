import { useQuery, type ApolloError } from "@apollo/client";
import { Banner, DataTable, EmptyData, Header, LayoutContent, Loader, Paper } from "@jahia/moonstone";
import type { ColumnFiltersState } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { i18n, NAMESPACE } from "../i18n.ts";
import { buildColumns, toRow } from "./columns.tsx";
import { toHistoryFilter, withColumnFilter } from "./filters.ts";
import { ClearFilters, FilterControls, PathFilter } from "./HistoryFilters.tsx";
import { SITE_HISTORY_QUERY, type HistoryEntry, type SiteHistoryData, type SiteHistoryVariables } from "./siteHistory.gql.ts";
import styles from "./SiteHistoryApp.module.css";

const ITEMS_PER_PAGE_OPTIONS = [20, 50, 100];

const isAccessDenied = (error: ApolloError): boolean =>
  error.graphQLErrors.some(e => /AccessDenied|permission/i.test(e.message ?? ""));

const isPathOutsideSite = (error: ApolloError): boolean =>
  error.graphQLErrors.some(e => /path must be/.test(e.message ?? ""));

type SiteHistoryProps = Readonly<{ siteKey: string }>;

const SiteHistory = ({ siteKey }: SiteHistoryProps) => {
  const { t } = useTranslation(NAMESPACE);
  const uiLanguage = globalThis.contextJsParameters?.uilang ?? "en";
  const sitePath = `/sites/${siteKey}`;
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE_OPTIONS[0]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const filter = useMemo(() => toHistoryFilter(columnFilters), [columnFilters]);

  const setFilter = (id: string, value: unknown) => {
    setColumnFilters(old => withColumnFilter(old, id, value));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setColumnFilters([]);
    setCurrentPage(1);
  };

  const { data, previousData, loading, error } = useQuery<SiteHistoryData, SiteHistoryVariables>(SITE_HISTORY_QUERY, {
    variables: {
      path: sitePath,
      uiLanguage,
      offset: (currentPage - 1) * itemsPerPage,
      limit: itemsPerPage,
      filter,
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

  const errorMessage = (apolloError: ApolloError): string => {
    if (isPathOutsideSite(apolloError)) {
      return t("siteHistory.filters.pathOutsideSite", { sitePath, interpolation: { escapeValue: false } });
    }
    if (isAccessDenied(apolloError)) {
      return t("siteHistory.accessDenied");
    }
    return t("siteHistory.error");
  };

  let content;
  if (error) {
    content = (
        <Banner title={t("siteHistory.errorTitle")} variant="danger" role="alert" data-sel-role="site-history-error">
            {errorMessage(error)}
        </Banner>
    );
  } else if (rows.length === 0 && loading) {
    content = <Loader size="big"/>;
  } else if (rows.length === 0 && columnFilters.length > 0) {
    content = <EmptyData message={t("siteHistory.filters.noMatch")} data-sel-role="site-history-no-match"/>;
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
      header={
          <Header
          title={t("siteHistory.title", { siteName })}
          search={<PathFilter filters={columnFilters} sitePath={sitePath} onChange={setFilter}/>}
          toolbarLeft={<FilterControls filters={columnFilters} locale={uiLanguage} onChange={setFilter}/>}
          toolbarRight={<ClearFilters filters={columnFilters} onClear={clearFilters}/>}
        />
      }
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
