# marketplace

## 0.1.4

### Patch Changes

- 567c23f: - **Annotation format updates**: Replace VCS-style source URLs (`git+https://...git`) with plain GitHub URLs, remove redundant `vnd.obsidianmd.layer.filename` layer annotations in favor of OCI-standard `org.opencontainers.image.title`, fix config media type to use shared constant, populate `introduction` from community-plugins.json description, add `org.opencontainers.image.description`
  - **New `shard marketplace sync` command**: Fetches an OCI manifest and generates a marketplace content markdown file from its annotations, with `--overwrite` flag and interactive prompt
  - **Build pipeline refactor**: Fold `generate-plugins-json` and `build-search-index` into a Vite plugin that runs at build time, remove standalone `marketplace:generate` script, simplify root package.json scripts
- Updated dependencies [567c23f]
  - @shard-for-obsidian/lib@0.3.3

## 0.1.3

### Patch Changes

- 2ec495d: Update namespace behavior to treat it as a container. Move to treating the manifest annotations as source of truth.
- Updated dependencies [2ec495d]
  - @shard-for-obsidian/lib@0.3.2

## 0.1.2

### Patch Changes

- Updated dependencies [632aaca]
  - @shard-for-obsidian/lib@0.3.1

## 0.1.1

### Patch Changes

- Updated dependencies [dbca3f2]
  - @shard-for-obsidian/lib@0.3.0
