# shard-lib

## 0.3.3

### Patch Changes

- 567c23f: - **Annotation format updates**: Replace VCS-style source URLs (`git+https://...git`) with plain GitHub URLs, remove redundant `vnd.obsidianmd.layer.filename` layer annotations in favor of OCI-standard `org.opencontainers.image.title`, fix config media type to use shared constant, populate `introduction` from community-plugins.json description, add `org.opencontainers.image.description`
  - **New `shard marketplace sync` command**: Fetches an OCI manifest and generates a marketplace content markdown file from its annotations, with `--overwrite` flag and interactive prompt
  - **Build pipeline refactor**: Fold `generate-plugins-json` and `build-search-index` into a Vite plugin that runs at build time, remove standalone `marketplace:generate` script, simplify root package.json scripts

## 0.3.2

### Patch Changes

- 2ec495d: Update namespace behavior to treat it as a container. Move to treating the manifest annotations as source of truth.

## 0.3.1

### Patch Changes

- 632aaca: Add verify command

## 0.3.0

### Minor Changes

- dbca3f2: Change behavior of convert command so data is mapped to annotations from community plugin registry and plugin manifest.

## 0.2.4

### Patch Changes

- a94f41a: Work in progress moving toward vendored annotations.
- 1c8e517: Test scoped package publishing workflow

## 0.2.3

### Patch Changes

- d961959: Bumped to trigger workflow

## 0.2.2

### Patch Changes

- 202bf93: Test publish
- 46a0d40: Test scoped package publishing workflow

## 0.2.1

### Patch Changes

- 2adeea8: Test scoped package publishing workflow

## 0.2.1

### Patch Changes

- 31aea03: Test patch version bump to verify npm publishing workflow with OIDC

## 0.2.0

### Minor Changes

- 971eead: Version bump to test publishing workflow.
