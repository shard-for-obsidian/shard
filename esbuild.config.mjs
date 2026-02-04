import esbuild from "esbuild";
import process from "process";
import { copy } from 'esbuild-plugin-copy';
import { builtinModules } from 'node:module'
import { cyclonedxEsbuildPlugin } from '@cyclonedx/cyclonedx-esbuild'

const prod = process.argv[2] === "production";
const outdir = prod && process.env.BUILD_OUTDIR ? process.env.BUILD_OUTDIR : "dist";

esbuild
  .build({
    entryPoints: ["src/plugin/main.ts"],
    bundle: true,
    treeShaking: prod,
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
    outfile: `${outdir}/main.js`,
    sourcemap: prod ? false : "inline",
    minify: prod,
    logLevel: "info",
    plugins: [
      copy({
        resolveFrom: 'cwd',
        assets: {
          from: ['./src/plugin/styles.css'],
          to: [`${outdir}/styles.css`],
        },
        watch: !prod,
      }),
      copy({
        // this is equal to process.cwd(), which means we use cwd path as base path to resolve `to` path
        // if not specified, this plugin uses ESBuild.build outdir/outfile options as base path.
        resolveFrom: 'cwd',
        assets: {
          from: ['./manifest.json'],
          to: [`${outdir}/manifest.json`],
        },
        watch: !prod,
      }),
      cyclonedxEsbuildPlugin({
        specVersion: '1.7',
        outputReproducible: true,
        validateResults: true,
        outputFile: 'sbom.json',
      })
    ]
  })
  .catch(() => process.exit(1));
