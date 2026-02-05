
# Shard Plugin System

This repository contains the Shard plugin system for managing plugins distributed via GitHub Container Registry (GHCR). It includes TypeScript types, utility functions, and examples to help developers create and manage plugins using GHCR as the distribution platform.

## Features

- [ ] GitHub Action for republishing Obsidian plugins to GHCR.
- [ ] Manifest schema for Obsidian plugins.
- [ ] CLI tool for bundling and publishing plugins.
- [ ] Configure snyk to scan published images for vulnerabilities.
- [ ] Attach attestations to published images for supply chain security.
  - [ ] SLSA attestation v1.2 (https://slsa.dev/)
  - [ ] SPDX SBOM (https://spdx.dev/) (using in-toto)
- [/] Plugin manager plugin for Obsidian to install and manage GHCR-hosted plugins.
  - [ ]


## Monorepo Structure

This repository is organized as a pnpm monorepo with three packages:

- **shard-lib** (`packages/shard-lib/`) - Core OCI registry client library
- **shard-installer** (`packages/shard-installer/`) - Plugin installer for Obsidian (or other platforms)
- **shard-cli** (`packages/shard-cli/`) - CLI tool for pushing/pulling plugins to/from GHCR

### Development

Install dependencies:
```bash
pnpm install
```

Build all packages:
```bash
pnpm build
```


Build individual package:
```bash
cd packages/shard-installer && pnpm build
```

Lint:
```bash
pnpm lint
``` 