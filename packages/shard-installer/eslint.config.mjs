import baseConfig from "../../eslint.base.mjs";
import obsidianPlugin from "eslint-plugin-obsidianmd";

export default [
  ...baseConfig,
  {
    files: ["**/*.ts"],
    plugins: { obsidianmd: obsidianPlugin },
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "no-prototype-builtins": "off",
      "@typescript-eslint/no-empty-function": "off"
    }
  }
];
