import js from "@eslint/js";
import typescript from "typescript-eslint";
import obsidianPlugin from "eslint-plugin-obsidianmd";

export default [
  js.configs.recommended,
  ...typescript.configs.recommended,
  {
    ignores: ["**/dist/**", "**/node_modules/**", ".worktrees/**", "**/esbuild.config.mjs"]
  },
  {
    // Plugin-specific rules
    files: ["packages/plugin/**/*.ts"],
    plugins: { obsidianmd: obsidianPlugin },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "args": "none" }],
      "@typescript-eslint/ban-ts-comment": "off",
      "no-prototype-builtins": "off",
      "@typescript-eslint/no-empty-function": "off"
    }
  },
  {
    // CLI and lib rules
    files: ["packages/{cli,lib}/**/*.ts"],
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "args": "none" }]
    }
  }
];
