import esbuild from "esbuild";
import process from "process";
import { builtinModules } from 'node:module'

const prod = process.argv[2] === "production";

esbuild
  .build({
    entryPoints: ["src/main.ts"],
    bundle: true,
    external: [
      "obsidian",
      "electron",
      "@codemirror/autocomplete",
      "@codemirror/collab",
      "@codemirror/commands",
      "@codemirror/language",
      "@codemirror/lint",
      "@codemirror/search",
      "@codemirror/state",
      "@codemirror/view",
      "@lezer/common",
      "@lezer/highlight",
      "@lezer/lr",
      ...builtinModules,
    ],
    format: "cjs",
    target: "es2020",
    outfile: "main.js",
    sourcemap: prod ? false : "inline",
    minify: prod,
    logLevel: "info",
  })
  .catch(() => process.exit(1));
