import baseConfig from "./eslint.base.mjs";

// Root-level config that imports package-specific configs
export default [
  ...baseConfig,
  {
    // Packages have their own eslint.config.mjs files
    ignores: ["packages/**"]
  }
];
