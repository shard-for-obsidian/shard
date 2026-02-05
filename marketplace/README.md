# Shard Plugin Marketplace

This directory contains plugin metadata for the Shard marketplace.

## Submitting Your Plugin

To submit your plugin to the Shard marketplace:

1. Fork this repository
2. Create a new YAML file in `plugins/` directory named `<plugin-id>.yml`
3. Fill in the required metadata (see template below)
4. Submit a pull request

### Plugin Metadata Template

```yaml
id: your-plugin-id
name: Your Plugin Name
author: Your Name
description: A brief description of your plugin
repo: https://github.com/username/repository
```

### Requirements

- Plugin must be published to GHCR (GitHub Container Registry)
- Plugin must follow OCI format specification
- Repository must be publicly accessible or provide auth documentation

## Plugin Index

The `plugins.json` file is automatically generated from the YAML files in the `plugins/` directory by a GitHub Action. Do not edit it manually.
