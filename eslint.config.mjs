// eslint.config.mjs
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default tseslint.config(
  eslint.configs.recommended,
  ...obsidianmd.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["*.config.mjs", "main.js", "node_modules/**", "dist/**", "src/cli/dist/**"],
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      "obsidianmd/hardcoded-config-path": "off",
      "no-console": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
      "@typescript-eslint/ban-ts-comment": "off",
      "no-prototype-builtins": "off",
      "@typescript-eslint/no-empty-function": "off",
    },
  },
  {
    files: ["src/cli/**/*.ts", "src/lib/client/node-fetch-adapter.ts", "src/lib/client/registry-client.ts", "src/plugin/settings.ts"],
    rules: {
      "no-restricted-globals": "off",
      "import/no-nodejs-modules": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  }
);
