import globals from "globals";

import { config as baseConfig } from "./base.js";

/**
 * A shared ESLint config for Node/Bun services.
 *
 * @type {import("eslint").Linter.Config}
 */
export const nodeConfig = [
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
