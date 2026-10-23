import { useQuery, type ApolloError } from "@apollo/client";
import { Banner, DataTable, EmptyData, Header, LayoutContent, Loader, Paper } from "@jahia/moonstone";
import type { SortDirection } from "@jahia/moonstone/DataTable";
import type { ColumnFiltersState, SortingState, VisibilityState } from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useState } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { i18n, NAMESPACE } from "../i18n.ts";
import { MOONSTONE_SCOPE_ATTRIBUTE } from "../moonstoneScope.ts";
import { buildColumns, toRow, type HistoryTableRow } from "./columns.tsx";
import { columnIncludes, isColumnVisible, readColumnVisibility, writeColumnVisibility } from "./columnVisibility.ts";
import { toHistoryFilter, withColumnFilter } from "./filters.ts";
import { HistoryFilters, type PickedUser } from "./HistoryFilters.tsx";
import { SITE_HISTORY_QUERY, type HistoryEntry, type SiteHistoryData, type SiteHistoryVariables } from "./siteHistory.gql.ts";
import styles from "./SiteHistoryApp.module.css";
import { DEFAULT_SORTING, toHistorySort } from "./sorting.ts";

const ITEMS_PER_PAGE_OPTIONS = [20, 50, 100];
const DEFAULT_ITEMS_PER_PAGE = 100;
const MAX_USERS = 100;

const isAccessDenied = (error: ApolloError): boolean =>
  error.graphQLErrors.some(e => /AccessDenied|permission/i.test(e.message ?? ""));

const isPathOutsideSite = (error: ApolloError): boolean =>
  error.graphQLErrors.some(e => /path must be/.test(e.message ?? ""));

const isTooManyUsers = (error: ApolloError): boolean =>
  error.graphQLErrors.some(e => /userKeys must hold at most/.test(e.message ?? ""));

type NoRowsProps = Readonly<{ isLoading: boolean; isFiltered: boolean }>;

const NoRows = ({ isLoading, isFiltered }: NoRowsProps) => {
  const { t } = useTranslation(NAMESPACE);
  if (isLoading) {
    return <Loader size="big"/>;
  }
  if (isFiltered) {
    return <EmptyData message={t("siteHistory.filters.noMatch")} data-sel-role="site-history-no-match"/>;
  }
  return <EmptyData message={t("siteHistory.empty")} data-sel-role="site-history-empty"/>;
};

type SiteHistoryProps = Readonly<{ siteKey: string; language: string }>;

const SiteHistory = ({ siteKey, language }: SiteHistoryProps) => {
  const { t } = useTranslation(NAMESPACE);
  const uiLanguage = globalThis.contextJsParameters?.uilang ?? "en";
  const sitePath = `/sites/${siteKey}`;
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  // LayoutContent unmounts the filters while a page loads with no previous rows, so the picked users live here.
  const [pickedUsers, setPickedUsers] = useState<PickedUser[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(readColumnVisibility);
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const filter = useMemo(() => toHistoryFilter(columnFilters), [columnFilters]);
  const sort = useMemo(() => toHistorySort(sorting), [sorting]);
  const paperRef = useRef<HTMLElement>(null);

  // The Paper stays mounted on a new page, so without this reset the page opens at the scroll offset of the old one.
  useEffect(() => {
    paperRef.current?.scrollTo({ top: 0 });
  }, [currentPage, itemsPerPage, filter, sort]);

  const setFilter = (id: string, value: unknown) => {
    setColumnFilters(old => withColumnFilter(old, id, value));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setColumnFilters([]);
    setCurrentPage(1);
  };

  const changeSort = (id: string, direction: SortDirection) => {
    setSorting([{ id, desc: direction === "descending" }]);
    setCurrentPage(1);
  };

  const changeColumnVisibility = (visibility: VisibilityState) => {
    setColumnVisibility(visibility);
    writeColumnVisibility(visibility);
    // A hidden column shows no sort arrow, so the table returns to the default order.
    if (!isColumnVisible(visibility, sorting[0].id)) {
      setSorting(DEFAULT_SORTING);
      setCurrentPage(1);
    }
  };

  const { data, previousData, loading, error } = useQuery<SiteHistoryData, SiteHistoryVariables>(SITE_HISTORY_QUERY, {
    variables: {
      path: sitePath,
      uiLanguage,
      offset: (currentPage - 1) * itemsPerPage,
      limit: itemsPerPage,
      filter,
      sort,
      ...columnIncludes(columnVisibility),
    },
    fetchPolicy: "network-only",
    client: globalThis.jahia?.apolloClient,
    skip: !siteKey,
  });

  const shown = data ?? (loading ? previousData : undefined);
  const site = shown?.jcr?.nodeByPath;
  const totalItems = site?.siteHistory?.totalCount ?? previousData?.jcr?.nodeByPath?.siteHistory?.totalCount ?? 0;
  const entries = site?.siteHistory?.entries;

  const columns = useMemo(() => buildColumns(t, language), [t, language]);
  const choosableColumns = useMemo(
    () => columns.map(({ key, label, menuLabel }) => ({ key, label: menuLabel ?? label })),
    [columns],
  );
  const visibleColumns = useMemo(
    () => columns.filter(column => isColumnVisible(columnVisibility, column.key)),
    [columns, columnVisibility],
  );
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
    if (isTooManyUsers(apolloError)) {
      return t("siteHistory.filters.tooManyUsers", { max: MAX_USERS });
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
  } else if (visibleColumns.length === 0) {
    content = <EmptyData message={t("siteHistory.columnChoice.noneVisible")} data-sel-role="site-history-no-column"/>;
  } else if (rows.length === 0) {
    content = <NoRows isLoading={loading} isFiltered={columnFilters.length > 0}/>;
  } else {
    content = (
        <div className={styles.tableArea}>
            <Paper ref={paperRef} hasPadding={false} className={styles.tableWrapper} aria-busy={loading} data-sel-role="site-history-table">
                <DataTable
          enablePagination
          enableSorting
          primaryKey="id"
          data={rows}
          columns={visibleColumns}
          sortBy={sorting[0].id as keyof HistoryTableRow}
          sortDirection={sorting[0].desc ? "descending" : "ascending"}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          itemsPerPageOptions={ITEMS_PER_PAGE_OPTIONS}
          totalItems={totalItems}
          rowProps={{ className: styles.denseRow }}
          paginationProps={{ className: styles.stickyPagination }}
          i18n={{
            itemsPerPage: t("siteHistory.pagination.itemsPerPage"),
            of: t("siteHistory.pagination.of"),
          }}
          onSortChange={changeSort}
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
          <HistoryFilters
          columns={choosableColumns}
          columnVisibility={columnVisibility}
          filters={columnFilters}
          pickedUsers={pickedUsers}
          siteKey={siteKey}
          sitePath={sitePath}
          language={language}
          locale={uiLanguage}
          onChange={setFilter}
          onPickUsers={setPickedUsers}
          onClear={clearFilters}
          onColumnVisibilityChange={changeColumnVisibility}
        />
          {content}
      </LayoutContent>
  );
};

const SiteHistoryApp = ({ siteKey, language }: SiteHistoryProps) => {
  // The bundled moonstone tokens apply while this attribute is set, as vite.config.ts states.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute(MOONSTONE_SCOPE_ATTRIBUTE, "");
    return () => root.removeAttribute(MOONSTONE_SCOPE_ATTRIBUTE);
  }, []);

  return (
      <I18nextProvider i18n={i18n} defaultNS={NAMESPACE}>
          <SiteHistory siteKey={siteKey} language={language}/>
      </I18nextProvider>
  );
};

export default SiteHistoryApp;
