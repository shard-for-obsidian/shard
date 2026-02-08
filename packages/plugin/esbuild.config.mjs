import esbuild from "esbuild";
import process from "process";
import { copy } from 'esbuild-plugin-copy';
import { builtinModules } from 'node:module'
import { cyclonedxEsbuildPlugin } from '@cyclonedx/cyclonedx-esbuild'
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const isProd = process.argv[2] === "production";
console.log(`Building for ${isProd ? "production" : "development"}...`);
let outdir = 'dist';

if (!isProd && process.env.LOCAL_PLUGIN_DIR) {
  console.log(`Local plugin directory set to ${process.env.LOCAL_PLUGIN_DIR}`);
  outdir = process.env.LOCAL_PLUGIN_DIR;
}

// Bundle CSS files from styles/ directory
const stylesDir = 'styles';
const cssFiles = readdirSync(stylesDir)
  .filter((f) => f.endsWith('.css'))
  .sort(); // Sort for consistent ordering

const cssContent = cssFiles
  .map((f) => {
    const content = readFileSync(join(stylesDir, f), 'utf8');
    return `/* ${f} */\n${content}`;
  })
  .join('\n\n');

// Minify CSS in production by removing comments and extra whitespace
const processedCss = isProd
  ? cssContent
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/\s*([{}:;,])\s*/g, '$1') // Remove spaces around CSS tokens
      .trim()
  : cssContent;

// Ensure output directory exists
mkdirSync(outdir, { recursive: true });

writeFileSync(join(outdir, 'styles.css'), processedCss);
console.log(`Bundled ${cssFiles.length} CSS files into ${outdir}/styles.css`);

const context = await esbuild
  .context({
    entryPoints: ["src/main.ts"],
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
