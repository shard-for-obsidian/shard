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

Though plugins have their source repository validated before being included in the community directory, there is no guarantee that the plugin bundle itself has not been tampered with after the fact. Further, subsequent releases don't receive any validation at all. By leveraging GHCR's support for image signing and vulnerability scanning, Shard can provide a more secure plugin distribution mechanism.

## Planned features

- [ ] Automated vulnerability scanning for plugin bundles
- [ ] Static analysis security tools for plugin bundles.
  - [ ] Enumerate nodejs APIs used in plugins to detect potentially unsafe operations.
  - [ ] Enumerate remote network calls made by plugins to detect potential data exfiltration.
- [ ] Plugin signing and verification
- [ ] Documentation and examples for developers
- [ ] GitHub Actions for automated plugin publishing
