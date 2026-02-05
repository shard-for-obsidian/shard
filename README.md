<p align="center">
  <img src="https://github.com/sharp-for-obsidian/sharp/blob/main/docs/attachments/shard-full-logo.png?raw=true" />
</p>


# Shard plugin system for Obsidian

This repository contains the Shard plugin system for managing Obsidian plugins distributed via GitHub Container Registry (GHCR). It includes TypeScript types, utility functions, and (eventually) examples to help developers create and manage plugins using GHCR as the distribution platform.

## Shortcomings of the official Obsidian plugin system
The official Obsidian plugin system has several limitations that Shard aims to address:

- **Distribution**: The official system relies on the Obsidian community plugin directory, which can be slow to update and may not support all use cases. Shard allows developers to distribute plugins via GHCR, enabling faster updates and more control over distribution.
- **Security**: The official system does not provide built-in mechanisms for verifying plugin authenticity or integrity. Shard can leverage GHCR's support for image signing and vulnerability scanning to enhance security.
- **Privacy**: The official system requires plugins to be publicly listed in the community directory. Shard allows developers to host private plugins in GHCR, providing more control over access.


## Components

- **Core Library**: A TypeScript library for interacting with GHCR, including functions for pushing, pulling, and managing plugin packages.
- **Plugin Installer**: A plugin for Obsidian that allows users to browse, install, and manage plugins from GHCR repositories.
- **CLI Tool**: A command-line interface for developers to easily push and pull plugins to/from GHCR.

## Feature Roadmap
- [x] Core library for GHCR interaction
- [x] Obsidian plugin installer
- [x] CLI tool for plugin management
- [ ] GitHub hosted marketplace for Shard plugins
- [ ] Support for plugin signing and verification
- [ ] Documentation and examples for developers
- [ ] GitHub Actions for automated plugin publishing


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
