import dayjs from "dayjs";
import "dayjs/locale/de";
import "dayjs/locale/en";
import "dayjs/locale/fr";
import localizedFormat from "dayjs/plugin/localizedFormat";

dayjs.extend(localizedFormat);

export const formatDate = (date: string | null | undefined, locale: string): string =>
  date ? dayjs(date).locale(locale).format("lll") : "";
