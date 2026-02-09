import esbuild from "esbuild";

const production = process.argv[2] === "production";

await esbuild.build({
  entryPoints: [
    "src/index.ts",
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

console.log("✓ lib built successfully");
