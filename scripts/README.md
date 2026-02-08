# Shard Scripts

Utility scripts for managing Shard plugins and registry operations.

## generate-plugin-markdown.sh

Generates markdown documentation files for all Obsidian community plugins in the marketplace.

### Prerequisites

- `jq` command-line JSON processor

### Usage

```bash
# Run from repository root
./scripts/generate-plugin-markdown.sh
```

### What it does

1. Fetches the latest community plugins list from the Obsidian releases repository
2. Generates a markdown file for each plugin in `apps/marketplace/content/plugins/`
3. Skips plugins that already have markdown files (won't overwrite existing files)
4. Creates frontmatter with plugin metadata (id, name, author, description, repository, registryUrl)

### Example output

```
Fetching community plugins list...
Found 2726 plugins

Generating markdown files...
====================

[1/2726] Processing: Natural Language Dates (nldates-obsidian)
  ✓ Created

[2/2726] Processing: Hotkeys++ (hotkeysplus-obsidian)
  ℹ Already exists, skipping

...

====================
Generation Complete
====================
Created: 2723
Skipped: 3
Failed:  0

Files saved to: ./apps/marketplace/content/plugins
```

### Generated file format

Each generated markdown file contains:

```markdown
---
id: plugin-id
registryUrl: ghcr.io/shard-for-obsidian/shard/community/plugin-id
name: Plugin Name
author: Plugin Author
description: Short description of the plugin
repository: https://github.com/author/repo
---

Short description of the plugin
```

Additional metadata fields (like `minObsidianVersion`, `authorUrl`, etc.) can be added manually or will be resolved when the marketplace site is built.

## make-packages-public.sh

Changes the visibility of all packages under `ghcr.io/shard-for-obsidian/shard/community` to public.

### Prerequisites

- GitHub CLI (`gh`) installed and authenticated
- Appropriate permissions to modify package visibility in the organization

### Usage

```bash
# Authenticate with GitHub CLI (if not already)
gh auth login

# Run from repository root
./scripts/make-packages-public.sh
```

### What it does

1. Fetches all container packages from the `shard-for-obsidian` organization
2. Filters for packages under the `shard/community/` namespace
3. Checks current visibility of each package
4. Changes visibility to `public` if not already public
5. Skips packages that are already public
6. Shows progress and summary statistics

### Example output

```
Fetching packages from shard-for-obsidian/shard...

Found 50 package(s) under community/

Processing packages...
====================

[1/50] Processing: shard/community/nldates-obsidian
  Current visibility: private
  ✓ Changed to public

[2/50] Processing: shard/community/hotkeysplus-obsidian
  Current visibility: public
  ℹ Already public, skipping

...

====================
Processing Complete
====================
Changed to public: 45
Already public:    5
Failed:            0
```

### Installing GitHub CLI

**macOS:**

```bash
brew install gh
```

**Ubuntu/Debian:**

```bash
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh
```

**Windows:**

```bash
winget install --id GitHub.cli
```

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
