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

**Implemented:**

Visit the marketplace at: `https://gillisandrew.github.io/shard/`

Features:
- Browse all available plugins
- Search plugins by name, description, author, or tags (real-time filtering)
- View plugin details including version, license, and requirements
- Click-to-copy installation commands
- Responsive design for mobile and desktop
- Built with Hugo static site generator

**Technology:**
- Static site generated with Hugo
- Real-time JavaScript search (no server required)
- Loads plugin data from `plugins.json`
- Automatically deployed via GitHub Actions

### CLI Interface

**Implemented:**

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
shard marketplace info plugin-id
```

Install a plugin by ID:
```bash
shard marketplace install plugin-id --output ./plugins/plugin-name
```

Register a plugin to the marketplace:
```bash
shard marketplace register ghcr.io/owner/plugin:tag
```

Update a marketplace entry:
```bash
shard marketplace update ghcr.io/owner/plugin:tag
```

## Installing from Marketplace

### Via Obsidian Plugin

**Implemented:**

1. Open Obsidian
2. Go to Settings > Shard Installer
3. Browse marketplace tab
4. Click "Browse Versions" on desired plugin
5. Select version and install

### Via CLI

**Implemented:**

Install directly by plugin ID:
```bash
shard marketplace install plugin-id --output ~/.obsidian/plugins/plugin-name
```

Or use the GHCR URL directly:
```bash
shard pull ghcr.io/owner/plugin:tag --output ~/.obsidian/plugins/plugin-name
```

## Marketplace Registry Format

Each plugin entry is stored as YAML in `marketplace/plugins/{plugin-id}.yml` and automatically converted to JSON in `marketplace/plugins.json`:

### YAML Format

```yaml
id: plugin-id
registryUrl: ghcr.io/owner/plugin
name: Plugin Name
author: Author Name
description: Plugin description
version: 1.0.0
repository: https://github.com/owner/plugin
minObsidianVersion: 0.15.0
authorUrl: https://author.com
license: MIT
tags:
  - productivity
  - notes
updatedAt: 2025-01-15T12:00:00Z
```

### JSON Schema

The generated `plugins.json` contains:

```json
{
  "plugins": [
    {
      "id": "plugin-id",
      "registryUrl": "ghcr.io/owner/plugin",
      "name": "Plugin Name",
      "author": "Author Name",
      "description": "Plugin description",
      "version": "1.0.0",
      "repository": "https://github.com/owner/plugin",
      "minObsidianVersion": "0.15.0",
      "authorUrl": "https://author.com",
      "license": "MIT",
      "tags": ["productivity", "notes"],
      "updatedAt": "2025-01-15T12:00:00Z"
    }
  ]
}
```

**Required Fields:**
- `id` - Plugin ID from manifest
- `registryUrl` - GHCR registry URL (primary identifier)
- `name` - Display name
- `author` - Author name
- `description` - Description
- `version` - Latest version
- `updatedAt` - Last update timestamp (ISO 8601)

**Optional Fields:**
- `repository` - GitHub repository URL (derived from OCI annotations)
- `minObsidianVersion` - Minimum Obsidian version
- `authorUrl` - Author website
- `license` - License identifier
- `tags` - Categorization tags

## Updating Marketplace Entries

To update your plugin listing:

1. Publish new version to GHCR using `shard push`
2. Update marketplace entry:
```bash
shard marketplace update ghcr.io/owner/plugin:newtag
```
3. Submit pull request with updated YAML

The marketplace will automatically update metadata from the new version by pulling fresh data from GHCR.

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

## Developing the Marketplace Site

The marketplace website is built with Hugo and can be developed locally:

### Prerequisites
- Hugo (install from https://gohugo.io/installation/)

### Local Development

1. Navigate to marketplace directory:
```bash
cd marketplace
```

2. Generate plugins.json (if needed):
```bash
# Run the same commands as the GitHub Action
echo '{"plugins":[]}' > plugins.json
for file in plugins/*.yml; do
  if [ -f "$file" ]; then
    plugin_json=$(yq eval -o=json "$file")
    jq --argjson plugin "$plugin_json" '.plugins += [$plugin]' plugins.json > /tmp/merged.json
    mv /tmp/merged.json plugins.json
  fi
done
jq '.' plugins.json > /tmp/formatted.json
mv /tmp/formatted.json plugins.json
```

3. Start Hugo development server:
```bash
hugo server -D
```

4. Open http://localhost:1313/shard/ in your browser

### Site Structure

```
marketplace/
├── hugo.toml              # Hugo configuration
├── content/               # Markdown content
├── layouts/               # HTML templates
│   ├── index.html        # Main plugin listing page
│   ├── _default/         # Base templates
│   └── partials/         # Reusable components
├── static/
│   └── css/
│       └── style.css     # Styles
└── plugins.json          # Generated plugin data
```

### Customizing the Site

- **Styling**: Edit `static/css/style.css`
- **Layout**: Edit templates in `layouts/`
- **Search logic**: Modify JavaScript in `layouts/index.html`
- **Site config**: Edit `hugo.toml`

## Contributing to Marketplace

The marketplace is open source and welcomes contributions:
- Submit plugins via CLI or pull request
- Report issues on GitHub
- Suggest improvements to marketplace UI
- Help moderate plugin submissions
- Contribute to Hugo site design and functionality

## API Access

**Implemented:**

Get all plugins as JSON:
```bash
# From GitHub (always latest)
curl https://raw.githubusercontent.com/gillisandrew/shard/main/marketplace/plugins.json

# From GitHub Pages (deployed version)
curl https://gillisandrew.github.io/shard/plugins.json
```

The JSON format includes all plugin metadata:
- Registry URL, version, author, description
- Repository URL, license, tags
- Minimum Obsidian version
- Last updated timestamp

This API is consumed by:
- The Shard Installer Obsidian plugin
- The marketplace CLI commands
- The marketplace website

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
