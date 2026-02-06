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
registryUrl: ghcr.io/username/repository
name: Your Plugin Name
author: Your Name
description: A brief description of your plugin
version: 1.0.0
repository: https://github.com/username/repository
minObsidianVersion: 0.15.0
authorUrl: https://yourwebsite.com
updatedAt: 2025-02-05T00:00:00Z
```

**Required fields:**
- `id` - Plugin ID from manifest.json
- `registryUrl` - GHCR registry URL (e.g., ghcr.io/owner/repo)
- `name` - Plugin display name
- `author` - Plugin author
- `description` - Brief description
- `version` - Latest published version
- `updatedAt` - ISO 8601 timestamp

**Optional fields:**
- `repository` - GitHub repository URL (auto-derived from OCI annotations)
- `minObsidianVersion` - Minimum Obsidian version required
- `authorUrl` - Author website or profile URL
- `license` - Plugin license (e.g., MIT, GPL-3.0)
- `tags` - Array of category tags

### Requirements

- Plugin must be published to GHCR (GitHub Container Registry)
- Plugin must follow OCI format specification
- Plugin must include proper OCI annotations (automatically added by `shard push` and `shard convert`)
- Repository must be publicly accessible or provide auth documentation

## Plugin Index

The `plugins.json` file is automatically generated from the YAML files in the `plugins/` directory by a GitHub Action. Do not edit it manually.
