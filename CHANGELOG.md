# Changelog

All notable changes to the Shard project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - Unreleased

### Breaking Changes

- **Removed `marketplace` subcommand prefix**: User-facing marketplace commands (`list`, `search`, `info`, `install`) are now top-level commands instead of being under `marketplace` subcommand
- **Moved `pull` to `registry` subcommand**: The `pull` command has been reorganized under `registry` (now `registry pull`) to group all direct OCI registry operations together
- **TypeScript strict mode required**: Projects using Shard as a library must now enable `strict: true` in their TypeScript configuration

### Added

- **Stricli framework**: Migrated from Commander.js to Stricli for type-safe CLI parsing with improved help text and error messages
- **Pino structured logging**:
  - Dual-output logging: user-friendly messages to stderr and structured JSON logs to `~/.shard/shard.log`
  - Better debugging with structured log data
  - Automatic log rotation and management
- **Configuration file support**: Persistent configuration stored in `~/.shard/config.json`
  - Store authentication tokens
  - Save default output directories
  - Support for nested configuration keys with dot notation
- **Configuration management commands**:
  - `config get <key>` - Retrieve configuration values
  - `config set <key> <value>` - Set configuration values
  - `config list` - View all configuration
  - `config clear` - Reset all configuration
- **`--verbose` flag**: Added global verbose flag for detailed debugging output across all commands
- **Shell completion support**: Added placeholder commands for shell completion (`completion install`, `completion script`) - implementation coming in future release
- **Improved help text**: All commands now include detailed usage examples and descriptions

### Changed

- **Command organization**: Simplified command structure with marketplace commands at the root level
- **Logger output**: User-facing messages now output to stderr (following CLI best practices), while structured logs go to file
- **Help text format**: Enhanced help messages with command examples and better formatting
- **Error handling**: Improved error messages with more context and helpful suggestions

### Migration Guide

If you're upgrading from v0.2.x, update your commands as follows:

| Old Command                        | New Command                  |
| ---------------------------------- | ---------------------------- |
| `shard marketplace list`           | `shard list`                 |
| `shard marketplace search <query>` | `shard search <query>`       |
| `shard marketplace info <id>`      | `shard info <id>`            |
| `shard marketplace install <id>`   | `shard install <id>`         |
| `shard pull <repo>`                | `shard registry pull <repo>` |

**Configuration file**: If you previously passed tokens or output paths via flags or environment variables, consider storing them in the configuration file:

```bash
shard config set token YOUR_TOKEN
shard config set defaults.output ~/vault/.obsidian/plugins
```

**TypeScript projects**: Ensure `strict: true` is enabled in your `tsconfig.json` if you import Shard as a library.

For detailed migration information, see the [design document](https://github.com/shard-for-obsidian/shard/blob/main/design/stricli-pino-migration.md).

### Notes

- `registry push` command is a placeholder and not yet implemented
- `completion` commands are placeholders for future shell completion support

## [0.2.4] - 2024-12-XX

### Changed

- Work in progress moving toward vendored annotations
- Test scoped package publishing workflow

## [0.2.3] - 2024-12-XX

### Changed

- Bumped version to trigger workflow

## [0.2.2] - 2024-12-XX

### Changed

- Test scoped package publishing workflow
- Test publish

## [0.2.1] - 2024-12-XX

### Changed

- Test scoped package publishing workflow
- Test patch version bump to verify npm publishing workflow with OIDC

## [0.2.0] - 2024-12-XX

### Changed

- Version bump to test publishing workflow

---

[0.3.0]: https://github.com/shard-for-obsidian/shard/compare/v0.2.4...v0.3.0
[0.2.4]: https://github.com/shard-for-obsidian/shard/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/shard-for-obsidian/shard/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/shard-for-obsidian/shard/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/shard-for-obsidian/shard/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/shard-for-obsidian/shard/releases/tag/v0.2.0
