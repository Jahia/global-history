/// <reference types="vite/client" />

/* eslint-disable no-var -- a global that globalThis exposes must be declared with var */
declare var contextJsParameters: {
  uilang?: string;
  [key: string]: unknown;
} | undefined;

declare var jahia: {
  /** Jahia's shared Apollo client. */
  apolloClient?: import("@apollo/client").ApolloClient<
    import("@apollo/client").NormalizedCacheObject
  >;
  reduxStore?: {
    getState: () => { site?: string; language?: string; [k: string]: unknown };
  };
} | undefined;

/** The jContent module sets this object on every app shell page, in ContentPickerApi.jsx. Jahia does not document it. */
declare var CE_API: {
  /** Opens the picker dialog of jContent. The picker calls setValue only when lang is set. */
  openPicker?: (options: {
    type: string;
    site: string;
    lang: string;
    isMultiple?: boolean;
    /** A uuid or a path, or a node with a uuid and a path. The dialog reads the path of a node to preselect it. */
    value?: string | (string | { uuid: string; path: string })[];
    setValue: (nodes: {
      name: string;
      path: string;
      uuid: string;
      displayName?: string | null;
      /** The user picker adds the names of a user. */
      firstName?: { value?: string | null } | null;
      lastName?: { value?: string | null } | null;
    }[]) => void;
  }) => void;
} | undefined;
/* eslint-enable no-var */

declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
