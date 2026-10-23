import { Button, Close, Reload } from "@jahia/moonstone";
import { useTranslation } from "react-i18next";
import { NAMESPACE } from "../i18n.ts";

type ActionBarProps = Readonly<{
  isLoading: boolean;
  isFiltered: boolean;
  onRefresh: () => void;
  onClearFilters: () => void;
}>;

export const ActionBar = ({ isLoading, isFiltered, onRefresh, onClearFilters }: ActionBarProps) => {
  const { t } = useTranslation(NAMESPACE);
  return (
      <>
          <Button
        variant="ghost"
        icon={<Reload/>}
        label={t("siteHistory.refresh")}
        isDisabled={isLoading}
        data-sel-role="site-history-refresh"
        onClick={onRefresh}
      />
          <Button
        variant="ghost"
        icon={<Close/>}
        label={t("siteHistory.filters.clear")}
        isDisabled={!isFiltered}
        data-sel-role="filter-clear"
        onClick={onClearFilters}
      />
      </>
  );
};
