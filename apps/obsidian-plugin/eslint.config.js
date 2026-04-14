import { nodeConfig } from "@trawl/eslint-config/node";

/** @type {import("eslint").Linter.Config} */
export default [
  ...nodeConfig,
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-undef": "off",
    },
  },
  {
    ignores: ["main.js", "dist/**"],
  },
];
