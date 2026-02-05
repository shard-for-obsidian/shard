import esbuild from "esbuild";
import process from "process";
import { copy } from 'esbuild-plugin-copy';
import { builtinModules } from 'node:module'
import { cyclonedxEsbuildPlugin } from '@cyclonedx/cyclonedx-esbuild'

const isProd = process.argv[2] === "production";
console.log(`Building for ${isProd ? "production" : "development"}...`);
let outdir = 'dist';

if (!isProd && process.env.LOCAL_PLUGIN_DIR) {
  console.log(`Local plugin directory set to ${process.env.LOCAL_PLUGIN_DIR}`);
  outdir = process.env.LOCAL_PLUGIN_DIR;
}

const context = await esbuild
  .context({
    entryPoints: ["src/plugin/main.ts"],
    bundle: true,
    treeShaking: isProd,
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
    sourcemap: isProd ? false : "inline",
    minify: isProd,
    logLevel: "info",
    plugins: [
      copy({
        resolveFrom: 'cwd',
        assets: {
          from: ['./src/plugin/styles.css'],
          to: [`${outdir}/styles.css`],
        },
        watch: !isProd,
      }),
      copy({
        // this is equal to process.cwd(), which means we use cwd path as base path to resolve `to` path
        // if not specified, this plugin uses ESBuild.build outdir/outfile options as base path.
        resolveFrom: 'cwd',
        assets: {
          from: ['./manifest.json'],
          to: [`${outdir}/manifest.json`],
        },
        watch: !isProd,
      }),
      ...(isProd ? [cyclonedxEsbuildPlugin({
        specVersion: '1.7',
        outputReproducible: true,
        validateResults: true,
        outputFile: 'sbom.json',
      })] : []),
    ]
  });

if (isProd) {
  await context.rebuild();
  process.exit(0);
} else {
  console.log("Watching for changes...");
  await context.watch();
}
