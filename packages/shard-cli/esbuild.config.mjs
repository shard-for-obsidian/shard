import esbuild from "esbuild";

const production = process.argv[2] === "production";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/index.js",
  platform: "node",
  format: "esm",
  target: "node18",
  sourcemap: !production,
  minify: production,
  banner: {
    js: "#!/usr/bin/env node"
  },
  external: [],
});

console.log("✓ shard-cli built successfully");
