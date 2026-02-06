# Shard Plugin Marketplace

This directory contains the Shard marketplace website and plugin metadata.

## Website

The marketplace website is built with [SvelteKit](https://kit.svelte.dev/) and deployed to GitHub Pages.

**Live site:** https://shard-for-obsidian.github.io/shard/

### Architecture

- **Frontend**: SvelteKit with adapter-static for static site generation
- **UI**: shadcn-svelte components with Tailwind CSS v4
- **Search**: Client-side Lunr.js full-text search
- **Data**: OCI registry queries at build time via `scripts/generate-plugins-json.ts`

The SvelteKit app lives in `apps/marketplace/`. See [apps/marketplace/README.md](../apps/marketplace/README.md) for development details.

### Legacy Hugo Site

The previous Hugo-based site has been migrated to SvelteKit. Hugo configuration files remain in this directory for reference but are no longer used in production.

## Submitting Your Plugin

To submit your plugin to the Shard marketplace:

### Via CLI (Recommended)

```bash
# 1. Push your plugin to GHCR
shard push ./dist ghcr.io/username/your-plugin

# 2. Register to marketplace
shard marketplace register ghcr.io/username/your-plugin:1.0.0

# 3. Submit pull request with generated YAML
```

### Manually

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

## Automated Build

The `plugins.json` file and website are automatically generated and deployed via GitHub Actions:

1. When YAML files in `plugins/` change
2. GitHub Action generates `plugins.json` from YAML
3. Hugo builds the static site
4. Site is deployed to GitHub Pages

Do not edit `plugins.json` manually - it will be overwritten by the GitHub Action.
