import { defineConfig } from "vite";
import jahia from "@jahia/vite-federation-plugin";

export default defineConfig({
  build: {
    outDir: "./src/main/resources/javascript/apps/",
  },
  plugins: [
    jahia({
      exposes: {
        "./init": "./src/javascript/init.tsx",
      },
      dts: false,
      // Version 0.0.0 makes this remote lose every singleton election against the app shell.
      shared: {
        react: { singleton: true, version: "0.0.0" },
        "react-dom": { singleton: true, version: "0.0.0" },
        "@apollo/client": { singleton: true, version: "0.0.0" },
        "@jahia/ui-extender": { singleton: true, version: "0.0.0" },
        i18next: { singleton: true, version: "0.0.0" },
        "react-i18next": { singleton: true, version: "0.0.0" },
      },
    }),
  ],
});
