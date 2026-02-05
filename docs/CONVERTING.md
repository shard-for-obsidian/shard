# Converting Community Plugins

The Shard converter allows you to convert existing Obsidian community plugins into Shard-compatible packages.

## Overview

The converter:
- Fetches plugins from the official Obsidian community repository
- Downloads plugin artifacts from GitHub releases
- Creates Shard-compatible OCI artifacts
- Pushes converted plugins to GHCR

## Why Convert Plugins?

Converting community plugins to Shard format enables:
- **Private distribution**: Host converted plugins in private registries
- **Version pinning**: Lock to specific plugin versions
- **Offline caching**: Pre-download plugins for offline environments
- **Custom modifications**: Fork and modify plugins while maintaining update path
- **Security scanning**: Apply security tools to plugin bundles

## Prerequisites

Before converting plugins:
- Install Shard CLI (`pnpm install -g @shard/cli`)
- Authenticate with GHCR (`shard auth login`)
- Identify target plugin from community repository

## Finding Plugin Information

List available community plugins:
```bash
shard convert list
```

Search for specific plugins:
```bash
shard convert search "calendar"
```

Get plugin details:
```bash
shard convert info obsidian-calendar-plugin
```

## Converting a Plugin

### Basic Conversion

Convert and push to GHCR:
```bash
shard convert obsidian-calendar-plugin
```

This will:
1. Fetch plugin metadata from community repository
2. Download latest release from GitHub
3. Extract and validate plugin files
4. Create OCI artifact
5. Push to your default GHCR namespace

### Specifying Version

Convert specific version:
```bash
shard convert obsidian-calendar-plugin --version 1.5.10
```

### Custom Registry Destination

Push to custom registry:
```bash
shard convert obsidian-calendar-plugin --registry ghcr.io/myorg/plugins
```

### Dry Run

Preview conversion without pushing:
```bash
shard convert obsidian-calendar-plugin --dry-run
```

## Conversion Process Details

### Step 1: Metadata Fetch

The converter fetches plugin information from:
```
https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json
```

This provides:
- Plugin ID and name
- Author information
- Repository URL
- Description

### Step 2: Release Download

The converter downloads artifacts from GitHub releases:
- `main.js` (required)
- `manifest.json` (required)
- `styles.css` (optional)

### Step 3: Validation

The converter validates:
- manifest.json schema compliance
- Required files presence
- Version consistency
- File size limits

### Step 4: OCI Packaging

Creates an OCI artifact containing:
- Layer 0: manifest.json
- Layer 1: main.js
- Layer 2: styles.css (if present)
- Annotations with plugin metadata

### Step 5: Registry Push

Pushes artifact to GHCR with:
- Tag: plugin version (e.g., `1.5.10`)
- Tag: `latest`
- Metadata annotations

## Converted Plugin Structure

After conversion, the OCI artifact includes:

### Layers
```
ghcr.io/owner/obsidian-calendar-plugin:1.5.10
├── manifest.json (layer 0)
├── main.js (layer 1)
└── styles.css (layer 2, optional)
```

### Metadata Annotations
```json
{
  "org.opencontainers.image.source": "https://github.com/liamcain/obsidian-calendar-plugin",
  "org.opencontainers.image.description": "Simple calendar widget for Obsidian",
  "org.opencontainers.image.version": "1.5.10",
  "org.opencontainers.image.authors": "Liam Cain",
  "shard.plugin.id": "obsidian-calendar-plugin",
  "shard.plugin.converted": "true",
  "shard.plugin.original-repo": "obsidianmd/obsidian-releases"
}
```

## Using Converted Plugins

### Installation via CLI

Install converted plugin:
```bash
shard pull ghcr.io/owner/obsidian-calendar-plugin:latest
```

### Installation via Obsidian

1. Open Obsidian Settings > Shard Installer
2. Enter registry URL: `ghcr.io/owner/obsidian-calendar-plugin`
3. Click "Install"

### Updates

Check for updates:
```bash
shard convert check-updates obsidian-calendar-plugin
```

Update to latest version:
```bash
shard convert obsidian-calendar-plugin --update
```

## Batch Conversion

Convert multiple plugins:
```bash
shard convert batch plugins.txt
```

Where `plugins.txt` contains:
```
obsidian-calendar-plugin
dataview
templater-obsidian
```

## Advanced Usage

### Custom Manifest Modifications

Modify manifest during conversion:
```bash
shard convert obsidian-calendar-plugin --manifest-patch patch.json
```

Where `patch.json` contains:
```json
{
  "name": "Custom Calendar",
  "author": "Modified by Me"
}
```

### Filtering Files

Exclude specific files:
```bash
shard convert obsidian-calendar-plugin --exclude "*.map,*.ts"
```

### Adding Custom Files

Include additional files:
```bash
shard convert obsidian-calendar-plugin --include "./custom-config.json"
```

## Conversion Limitations

### Known Issues
- Some plugins use dynamic loading which may not work in converted form
- Plugins with external dependencies may require additional configuration
- Binary dependencies (.node files) are not automatically included
- Plugins using Electron APIs may have reduced functionality

### Unsupported Features
- Plugins with native modules
- Plugins requiring specific Obsidian versions with breaking changes
- Plugins with hardcoded update checks pointing to original repository

## Legal and Ethical Considerations

### Licensing
- Respect original plugin licenses
- Include license files in converted packages
- Do not distribute converted plugins without permission
- Give credit to original authors

### Attribution
The converter automatically adds attribution metadata:
```json
{
  "shard.plugin.original-author": "Original Author",
  "shard.plugin.original-repo": "owner/repo",
  "shard.plugin.converted": "true"
}
```

### Updates
- Monitor original repository for updates
- Do not claim converted plugins as your own work
- Contribute fixes upstream when possible

## Troubleshooting

### Download Failures
- Check internet connectivity
- Verify plugin exists in community repository
- Ensure GitHub releases are public
- Try specific version instead of latest

### Validation Errors
- Review manifest.json for syntax errors
- Ensure all required files are present
- Check file size limits
- Verify version format (semver)

### Push Failures
- Confirm GHCR authentication
- Check registry permissions
- Verify namespace exists
- Review network connectivity

### Installation Issues
- Ensure Obsidian version compatibility
- Check plugin dependencies
- Review Obsidian console for errors
- Try clearing Obsidian cache

## Best Practices

### For Personal Use
- Convert only plugins you actively use
- Keep track of original versions
- Document any modifications
- Maintain update schedule

### For Organizations
- Establish conversion policies
- Document approved plugin list
- Implement security scanning
- Maintain internal registry

### For Distribution
- Obtain permission from original authors
- Include complete attribution
- Monitor for security issues
- Provide support channels

## Automation

### GitHub Actions

Automate plugin conversion with GitHub Actions:

```yaml
name: Convert Community Plugin

on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly
  workflow_dispatch:

jobs:
  convert:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install Shard CLI
        run: npm install -g @shard/cli

      - name: Login to GHCR
        run: shard auth login --token ${{ secrets.GITHUB_TOKEN }}

      - name: Convert Plugin
        run: shard convert obsidian-calendar-plugin --update
```

### Monitoring Updates

Create a script to check for updates:

```bash
#!/bin/bash
PLUGINS="obsidian-calendar-plugin dataview templater-obsidian"

for plugin in $PLUGINS; do
  if shard convert check-updates $plugin | grep -q "update available"; then
    echo "Updating $plugin"
    shard convert $plugin --update
  fi
done
```

## Future Enhancements

Planned converter features:
- Automatic update detection and conversion
- Dependency resolution and bundling
- Plugin compatibility testing
- Security vulnerability scanning
- Automated license compliance checking
- Conversion quality metrics
