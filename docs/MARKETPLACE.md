# Marketplace Documentation

The Shard marketplace provides a centralized registry for discovering and sharing Shard plugins.

## Overview

The marketplace is hosted on GitHub Pages and provides:
- Plugin discovery and browsing
- Plugin metadata display
- Direct installation links
- Searchable plugin registry

## Marketplace Structure

The marketplace consists of:
- **Registry**: JSON files stored in `marketplace/registry/`
- **Static Site**: Generated HTML hosted on GitHub Pages
- **CLI Integration**: Commands for publishing and browsing plugins

## Publishing to the Marketplace

### Prerequisites
- Plugin must be published to GHCR
- Plugin must have valid manifest.json
- GitHub repository must be public (for marketplace listing)

### Publishing Steps

1. Publish your plugin to GHCR:
```bash
shard push path/to/plugin
```

2. Add your plugin to the marketplace:
```bash
shard marketplace add ghcr.io/owner/plugin:tag
```

This will:
- Fetch plugin metadata from GHCR
- Generate registry entry
- Create pull request to marketplace repository

### Plugin Metadata

The marketplace displays the following metadata:
- Plugin name and description
- Author information
- Version
- GHCR registry URL
- Repository URL (if available)
- License information

## Browsing the Marketplace

### Web Interface

Visit the marketplace at: `https://gillisandrew.github.io/shard-marketplace/`

Features:
- Search plugins by name or description
- Filter by author or tags
- View plugin details
- Copy installation commands

### CLI Interface

List all marketplace plugins:
```bash
shard marketplace list
```

Search for plugins:
```bash
shard marketplace search "keyword"
```

View plugin details:
```bash
shard marketplace info plugin-name
```

## Installing from Marketplace

### Via Obsidian Plugin

1. Open Obsidian
2. Go to Settings > Shard Installer
3. Browse marketplace tab
4. Click "Install" on desired plugin

### Via CLI

Install directly by name:
```bash
shard marketplace install plugin-name
```

Or use the GHCR URL:
```bash
shard pull ghcr.io/owner/plugin:tag
```

## Marketplace Registry Format

Each plugin entry is stored as JSON in `marketplace/registry/{owner}/{plugin}.json`:

```json
{
  "name": "plugin-name",
  "id": "plugin-id",
  "author": "author-name",
  "description": "Plugin description",
  "version": "1.0.0",
  "registryUrl": "ghcr.io/owner/plugin:tag",
  "repository": "https://github.com/owner/plugin",
  "license": "MIT",
  "tags": ["tag1", "tag2"],
  "updatedAt": "2025-01-15T12:00:00Z"
}
```

## Updating Marketplace Entries

To update your plugin listing:

1. Publish new version to GHCR
2. Update marketplace entry:
```bash
shard marketplace update ghcr.io/owner/plugin:newtag
```

The marketplace will automatically update metadata from the new version.

## Marketplace Policies

### Acceptance Criteria
- Plugin must be functional and not malicious
- Must include valid manifest.json
- Description must be clear and accurate
- Must not infringe on trademarks or copyrights

### Removal Policy
Plugins may be removed if they:
- Contain malware or malicious code
- Violate GitHub terms of service
- Are abandoned and non-functional
- Receive DMCA takedown requests

## Contributing to Marketplace

The marketplace is open source and welcomes contributions:
- Submit plugins via CLI or pull request
- Report issues on GitHub
- Suggest improvements to marketplace UI
- Help moderate plugin submissions

## API Access

The marketplace registry can be accessed programmatically:

```bash
# Get all plugins
curl https://gillisandrew.github.io/shard-marketplace/api/plugins.json

# Get specific plugin
curl https://gillisandrew.github.io/shard-marketplace/api/plugins/{owner}/{name}.json
```

## Best Practices

### For Plugin Authors
- Keep descriptions concise and clear
- Include screenshots in repository README
- Maintain semantic versioning
- Update marketplace entry when releasing new versions
- Respond to user issues and feedback

### For Users
- Review plugin permissions before installing
- Check plugin repository for activity and issues
- Report suspicious or malicious plugins
- Provide feedback to plugin authors

## Troubleshooting

### Plugin Not Appearing in Marketplace
- Ensure pull request was merged
- Check that registry JSON is valid
- Verify GHCR URL is accessible
- Allow up to 10 minutes for site rebuild

### Installation Failures
- Verify GHCR URL is correct
- Check internet connectivity
- Ensure plugin is compatible with Obsidian version
- Review Obsidian console for error messages

### Metadata Not Updating
- Confirm new version was pushed to GHCR
- Run `marketplace update` command
- Wait for pull request to be merged
- Clear browser cache for web interface

## Future Enhancements

Planned marketplace features:
- Plugin ratings and reviews
- Download statistics
- Plugin categories and collections
- Automated security scanning
- Plugin signing and verification
- Version compatibility tracking
