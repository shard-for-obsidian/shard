# Obsidian Community Plugin Specification

This repository contains a specification for Obsidian plugins that are hosted on GitHub Container Registry (GHCR). It includes TypeScript types, utility functions, and examples to help developers create and manage Obsidian plugins using GHCR as the distribution platform.

## Motivation

- Lack of visibility into the current obsidian plugin distribution.
- GitHub Releases are not ideal for distributing plugins since their contents are not immutable.
- GHCR provides a more robust and reliable way to distribute plugins with versioning and immutability.
- Lack of review in plugin updates.


### OCI Manifest for Obsidian Plugins

The specification defines an OCI (Open Container Initiative) manifest format for Obsidian plugins, allowing developers to package their plugins as OCI images. This includes metadata such as plugin name, version, description, and author information.

#### Config
The config section of the OCI manifest contains metadata about the plugin, including:
  - Plugin name
  - Version
  - Description
  - Author information
  - Minimum Obsidian app version required

#### Layers
The layers section contains the actual plugin files, such as JavaScript/TypeScript code, CSS stylesheets, and other assets required for the plugin to function.

