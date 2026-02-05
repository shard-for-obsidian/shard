import js from "@eslint/js";
import typescript from "typescript-eslint";

export default [
  js.configs.recommended,
  ...typescript.configs.recommended,
  {
    ignores: ["**/dist/**", "**/node_modules/**", ".worktrees/**", "**/esbuild.config.mjs"]
  },
  {
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "args": "none" }]
    }
  }
];
