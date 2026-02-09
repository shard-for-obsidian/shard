import esbuild from "esbuild";

const production = process.argv[2] === "production";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/index.js",
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: !production,
  minify: production,
  banner: {
    js: "#!/usr/bin/env node"
  },
  external: [
    "pino",
    "pino-pretty",
    "ora",
    "cli-progress",
  ],
});

console.log("✓ cli built successfully");
