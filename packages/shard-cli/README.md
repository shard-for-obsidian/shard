# Shard CLI

A command-line interface for managing Obsidian plugins through the Shard marketplace and OCI registries.

## Installation

```bash
npm install -g @shard-for-obsidian/cli
```

## Quick Start

```bash
# List all available plugins
shard list

# Search for a plugin
shard search "calendar"

# Get plugin information
shard info obsidian-calendar-plugin

# Install a plugin
shard install obsidian-calendar-plugin

# Configure the CLI
shard config set token YOUR_TOKEN
shard config list
```

## Commands Overview

### User Commands

Browse and manage plugins from the Shard marketplace.

#### `shard list`

List all plugins in the marketplace.

```bash
shard list                # List all plugins
shard list --verbose      # Show additional details
shard list --json         # Output as JSON
```

#### `shard search <query>`

Search for plugins in the marketplace.

```bash
shard search "calendar"           # Search for plugins
shard search "calendar" --json    # Output as JSON
```

#### `shard info <plugin-id>`

Show detailed information about a specific plugin.

```bash
shard info obsidian-calendar-plugin
shard info obsidian-calendar-plugin --json
```

#### `shard install <plugin-id>`

Install a plugin to your Obsidian vault.

```bash
shard install obsidian-calendar-plugin
shard install obsidian-calendar-plugin --output ~/path/to/vault/.obsidian/plugins
```

### Configuration Commands

Manage CLI configuration stored in `~/.shard/config.json`.

#### `shard config get <key>`

Get a configuration value.

```bash
shard config get token
shard config get defaults.output
```

#### `shard config set <key> <value>`

Set a configuration value.

```bash
shard config set token YOUR_TOKEN
shard config set defaults.output ~/vault/.obsidian/plugins
```

#### `shard config list`

List all configuration values.

```bash
shard config list
shard config list --json
```

#### `shard config clear`

Clear all configuration values.

```bash
shard config clear
```

### Registry Commands

Direct operations with OCI registries.

#### `shard registry pull <repository>`

Pull a plugin directly from an OCI registry.

```bash
shard registry pull ghcr.io/owner/repo:latest
shard registry pull ghcr.io/owner/repo:v1.2.3
shard registry pull ghcr.io/owner/repo:latest --output ~/vault/.obsidian/plugins
```

#### `shard registry versions <repository>`

List available versions for a repository.

```bash
shard registry versions ghcr.io/owner/repo
shard registry versions ghcr.io/owner/repo --json
```

### Utility Commands

#### `shard completion install`

Install shell completion (placeholder - not yet implemented).

#### `shard completion script`

Generate completion script (placeholder - not yet implemented).

## Configuration File

The CLI stores persistent configuration in `~/.shard/config.json`. The configuration file supports:

### Configuration Structure

```json
{
  "token": "your-registry-token",
  "defaults": {
    "output": "~/vault/.obsidian/plugins"
  }
}
```

### Supported Keys

- `token` - Authentication token for private registries
- `defaults.output` - Default output directory for plugin installations

Use dot notation to access nested configuration values:

```bash
shard config get defaults.output
shard config set defaults.output ~/path/to/plugins
```

## Global Flags

Available on all commands:

- `--verbose` - Enable verbose logging with detailed debugging information
- `--json` - Output results as JSON (where applicable)
- `--help` - Show help for any command

## Logging

The CLI uses structured logging:

- **Normal mode**: User-friendly messages to stderr
- **Verbose mode**: Detailed debugging information to stderr
- **Log file**: All logs are written to `~/.shard/shard.log` in structured JSON format

## Migration from v0.2.x

In v0.3.0, several commands have been reorganized for better clarity:

| Old Command                        | New Command                  |
| ---------------------------------- | ---------------------------- |
| `shard marketplace list`           | `shard list`                 |
| `shard marketplace search <query>` | `shard search <query>`       |
| `shard marketplace info <id>`      | `shard info <id>`            |
| `shard marketplace install <id>`   | `shard install <id>`         |
| `shard pull <repo>`                | `shard registry pull <repo>` |

See the [design document](https://github.com/shard-for-obsidian/shard/blob/main/design/stricli-pino-migration.md) for full migration details.

## Examples

### Browse the marketplace

```bash
# List all plugins
shard list

# Search for calendar plugins
shard search calendar

# Get detailed info about a specific plugin
shard info obsidian-calendar-plugin
```

### Install plugins

```bash
# Install using default output directory
shard config set defaults.output ~/vault/.obsidian/plugins
shard install obsidian-calendar-plugin

# Install to a specific location
shard install obsidian-calendar-plugin --output ~/other-vault/.obsidian/plugins
```

### Work with registries

```bash
# Pull directly from a registry
shard registry pull ghcr.io/owner/repo:latest

# Check available versions
shard registry versions ghcr.io/owner/repo

# Pull a specific version
shard registry pull ghcr.io/owner/repo:v1.2.3
```

### Configuration management

```bash
# Set up authentication token
shard config set token YOUR_GITHUB_TOKEN

# Configure default plugin directory
shard config set defaults.output ~/vault/.obsidian/plugins

# View all configuration
shard config list

# Get a specific value
shard config get token
```

## Requirements

- Node.js >= 18.0.0

## License

MIT

## Links

- [GitHub Repository](https://github.com/shard-for-obsidian/shard)
- [Issue Tracker](https://github.com/shard-for-obsidian/shard/issues)
- [Design Documents](https://github.com/shard-for-obsidian/shard/tree/main/design)
