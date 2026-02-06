<p align="center">
  <img src="https://github.com/gillisandrew/shard/blob/main/docs/attachments/shard-full-logo.png?raw=true" style="width: 256px;height: auto" alt="Shard for Obsidian logo" />
</p>


# Shard plugin system for Obsidian (EXPERIMENTAL)

This repository contains the Shard plugin system for managing Obsidian plugins distributed via GitHub Container Registry (GHCR). It includes TypeScript types, utility functions, and (eventually) examples to help developers create and manage plugins using GHCR as the distribution platform.

## Shortcomings of the official Obsidian plugin system
The official Obsidian plugin system has several limitations that Shard aims to address:

- **Distribution**: The official system relies on the Obsidian community plugin directory, which can be slow to update and may not support all use cases. Shard allows developers to distribute plugins via GHCR, enabling faster updates and more control over distribution.
- **Security**: The official system does not provide built-in mechanisms for verifying plugin authenticity or integrity. Shard can leverage GHCR's support for image signing and vulnerability scanning to enhance security.
- **Privacy**: The official system requires plugins to be publicly listed in the community directory. Shard allows developers to host private plugins in GHCR, providing more control over access.

The all or nothing approach of the official Obsidian plugin system forces users to either trust all community plugins or none at all. Shard aims to provide a more granular approach to plugin trust and verification.

## Components

- **Core Library**: A TypeScript library for interacting with GHCR, including functions for pushing, pulling, and managing plugin packages.
- **Plugin Installer**: A plugin for Obsidian that allows users to browse, install, and manage plugins from GHCR repositories.
- **CLI Tool**: A command-line interface for developers to easily push and pull plugins to/from GHCR.

## Feature Roadmap
- [x] Core library for GHCR interaction
- [x] Obsidian plugin installer
- [x] CLI tool for plugin management
  - [x] Push plugins to GHCR
  - [x] Pull plugins from GHCR
- [x] GitHub hosted community marketplace for Shard plugins
- [x] Legacy Obsidian community plugin directory integration. Simple cli tooling for fetching an existing community plugin and packaging it as a Shard plugin.

## Planned features
- [ ] Automated vulnerability scanning for plugin bundles
- [ ] Static analysis security tools for plugin bundles.
  - [ ] Enumerate nodejs APIs used in plugins to detect potentially unsafe operations.
  - [ ] Enumerate remote network calls made by plugins to detect potential data exfiltration.
- [ ] Plugin signing and verification
- [ ] Documentation and examples for developers
- [ ] GitHub Actions for automated plugin publishing


## Monorepo Structure

This repository is organized as a pnpm monorepo with three packages:

- **@shard-for-obsidian/lib** (`packages/shard-lib/`) - Core OCI registry client library
- **shard-installer** (`packages/shard-installer/`) - Plugin installer for Obsidian
- **@shard-for-obsidian/cli** (`packages/shard-cli/`) - CLI tool for pushing/pulling plugins to/from GHCR

## NPM Packages

This monorepo publishes two packages to npm:

- **[@shard-for-obsidian/cli](https://www.npmjs.com/package/@shard-for-obsidian/cli)**: CLI tool for managing Obsidian plugins via GHCR
- **[@shard-for-obsidian/lib](https://www.npmjs.com/package/@shard-for-obsidian/lib)**: Core library for OCI registry operations

See [NPM_PUBLICATION.md](docs/NPM_PUBLICATION.md) for details on versioning and releasing.

### Installation

Install the CLI globally:
```bash
npm install -g @shard-for-obsidian/cli
```

Or use the library in your project:
```bash
npm install @shard-for-obsidian/lib
```

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
