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
    getState: () => { site?: string; [k: string]: unknown };
  };
} | undefined;
/* eslint-enable no-var */

declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
