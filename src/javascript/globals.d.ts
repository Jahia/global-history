/// <reference types="vite/client" />

declare interface Window {
  contextJsParameters: {
    uilang?: string;
    [key: string]: unknown;
  };
  jahia?: {
    /** Jahia's shared Apollo client. */
    apolloClient?: import("@apollo/client").ApolloClient<
      import("@apollo/client").NormalizedCacheObject
    >;
    reduxStore?: {
      getState: () => { site?: string; [k: string]: unknown };
    };
  };
}

declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
