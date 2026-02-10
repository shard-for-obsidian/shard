---
"marketplace": patch
"@shard-for-obsidian/cli": patch
"@shard-for-obsidian/lib": patch
---

- **Annotation format updates**: Replace VCS-style source URLs (`git+https://...git`) with plain GitHub URLs, remove redundant `vnd.obsidianmd.layer.filename` layer annotations in favor of OCI-standard `org.opencontainers.image.title`, fix config media type to use shared constant, populate `introduction` from community-plugins.json description, add `org.opencontainers.image.description`
- **New `shard marketplace sync` command**: Fetches an OCI manifest and generates a marketplace content markdown file from its annotations, with `--overwrite` flag and interactive prompt
- **Build pipeline refactor**: Fold `generate-plugins-json` and `build-search-index` into a Vite plugin that runs at build time, remove standalone `marketplace:generate` script, simplify root package.json scripts
