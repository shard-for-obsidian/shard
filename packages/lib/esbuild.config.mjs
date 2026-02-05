import esbuild from "esbuild";

const production = process.argv[2] === "production";

await esbuild.build({
  entryPoints: [
    "src/registry-client.ts",
    "src/common.ts",
    "src/types.ts",
    "src/errors.ts",
    "src/fetch-adapter.ts",
    "src/ghcr.ts",
    "src/util/link-header.ts",
  ],
  bundle: false,
  outdir: "dist",
  platform: "neutral",
  format: "esm",
  target: "es2022",
  sourcemap: !production,
  minify: production,
  treeShaking: true,
});

console.log("✓ @plugin-manager/lib built successfully");
