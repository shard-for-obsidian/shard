# Shard Scripts

Utility scripts for managing Shard plugins and registry operations.

## convert-community-plugins.sh

Batch converts all plugins from the Obsidian community plugins list to OCI format and pushes them to the Shard registry.

### Prerequisites

- `jq` command-line JSON processor
- GitHub Personal Access Token with `write:packages` scope
- Shard CLI built (`pnpm build` from repo root)

### Usage

```bash
# Set your GitHub token
export GITHUB_TOKEN=ghp_your_token_here

# Run from repository root
./scripts/convert-community-plugins.sh
```

### What it does

1. Fetches the latest community plugins list from GitHub
2. Converts each plugin using `shard convert`
3. Pushes to `ghcr.io/shard-for-obsidian/shard/community/<plugin-id>`
4. Logs each conversion to `./conversion-logs/<plugin-id>.log`
5. Shows progress and summary statistics

### Options

You can modify the script to:

- Change the delay between conversions (default: 1 second)
- Adjust the registry base path
- Filter specific plugins

### Example output

```
Fetching community plugins list...
Found 1847 plugins to convert

Starting conversion...
====================

[1/1847] Converting: Natural Language Dates (nldates-obsidian)
  Repository: ghcr.io/shard-for-obsidian/shard/community/nldates-obsidian
  ✓ Success

[2/1847] Converting: Hotkeys++ (hotkeysplus-obsidian)
  Repository: ghcr.io/shard-for-obsidian/shard/community/hotkeysplus-obsidian
  ✓ Success

...

====================
Conversion Complete
====================
Success: 1800
Failed:  47
Skipped: 0

Logs saved to: ./conversion-logs
```

### Troubleshooting

**Rate limiting**: If you hit GitHub rate limits, increase the sleep delay in the script or run in batches.

**Authentication errors**: Ensure your `GITHUB_TOKEN` has the correct permissions (`write:packages` scope).

**Plugin not found**: Some plugins may have been removed or renamed in the community list. Check the log file for details.

### Installing jq

**macOS:**

```bash
brew install jq
```

**Ubuntu/Debian:**

```bash
sudo apt-get install jq
```

**Windows (WSL):**

```bash
sudo apt-get install jq
```
