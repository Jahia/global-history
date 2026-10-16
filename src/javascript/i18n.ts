import i18nModule from "i18next";

export const NAMESPACE = "global-history";

// The shared i18next has no __esModule marker, so the default import can be the module namespace.
export const i18n =
  typeof (i18nModule as { on?: unknown }).on === "function"
    ? i18nModule
    : ((i18nModule as { default?: typeof i18nModule }).default ?? i18nModule);
