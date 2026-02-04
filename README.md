# Obsidian Community Plugin Specification

This repository contains a specification for Obsidian plugins that are hosted on GitHub Container Registry (GHCR). It includes TypeScript types, utility functions, and examples to help developers create and manage Obsidian plugins using GHCR as the distribution platform.

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