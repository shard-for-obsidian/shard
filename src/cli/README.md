# Obsidian Plugin GHCR CLI

Command-line tool to push and pull Obsidian plugins to/from GitHub Container Registry (GHCR) as OCI artifacts.

## Installation

```bash
npm install -g obsidian-plugin-ghcr-cli
```

Or use directly with `npx`:

```bash
npx obsidian-plugin-ghcr-cli <command>
```

## Prerequisites

- Node.js 18 or later
- GitHub Personal Access Token (PAT) with `read:packages` and `write:packages` scopes

## Authentication

The CLI requires a GitHub token for authentication. It resolves tokens in the following priority order:

1. `--token` CLI flag (highest priority)
2. `GITHUB_TOKEN` environment variable (CI/CD)
3. `GH_TOKEN` environment variable (gh CLI compatibility)

### Creating a GitHub Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token" (classic)
3. Select the following scopes:
   - `read:packages` - for pulling plugins
   - `write:packages` - for pushing plugins
4. Generate and save the token securely

### Setting Environment Variables

```bash
# For CI/CD
export GITHUB_TOKEN="ghp_..."

# Or for gh CLI compatibility
export GH_TOKEN="ghp_..."
```

## Usage

### Push Command

Push an Obsidian plugin to GHCR:

```bash
obsidian-plugin push <directory> <repository> [options]
```

**Arguments:**
- `<directory>` - Path to plugin build output containing `manifest.json`, `main.js`, and optionally `styles.css`
- `<repository>` - GHCR repository without tag (e.g., `ghcr.io/username/plugin-name`)

**Options:**
- `--token <pat>` - GitHub Personal Access Token (overrides environment variables)
- `--json` - Output JSON result to stdout (logs go to stderr)
- `--help` - Show help

**Behavior:**
- Automatically tags the image with the version from `manifest.json`
- Discovers required files: `manifest.json` (required), `main.js` (required), `styles.css` (optional)
- Creates an OCI artifact compatible with ORAS
- Logs progress to stderr
- Outputs JSON result to stdout if `--json` flag is used

**Examples:**

```bash
# Push with environment token
export GITHUB_TOKEN="ghp_..."
obsidian-plugin push ./dist ghcr.io/username/my-plugin

# Push with CLI token
obsidian-plugin push ./dist ghcr.io/username/my-plugin --token ghp_...

# Push with JSON output
obsidian-plugin push ./dist ghcr.io/username/my-plugin --json > result.json
```

**Output (--json):**

```json
{
  "digest": "sha256:df0b6931cf48a5f73323f930b7099694bece2f781d66073e7e0ca48ea99775dd",
  "tag": "1.2.3",
  "size": 756,
  "repository": "ghcr.io/username/my-plugin:1.2.3"
}
```

### Pull Command

Pull an Obsidian plugin from GHCR:

```bash
obsidian-plugin pull <repository> --output <directory> [options]
```

**Arguments:**
- `<repository>` - Full reference with tag or digest (e.g., `ghcr.io/username/plugin:1.0.0`)

**Options:**
- `--output <dir>` - Where to extract files (required)
- `--token <pat>` - GitHub Personal Access Token (overrides environment variables)
- `--json` - Output JSON result to stdout (logs go to stderr)
- `--help` - Show help

**Behavior:**
- Downloads manifest and all layer blobs
- Extracts filenames from OCI annotations
- Creates output directory if it doesn't exist
- Verifies blob digests during download

**Examples:**

```bash
# Pull with tag
export GITHUB_TOKEN="ghp_..."
obsidian-plugin pull ghcr.io/username/my-plugin:1.0.0 --output ./plugin

# Pull with digest
obsidian-plugin pull ghcr.io/username/my-plugin@sha256:abc123... --output ./plugin

# Pull with JSON output
obsidian-plugin pull ghcr.io/username/my-plugin:1.0.0 --output ./plugin --json > result.json
```

**Output (--json):**

```json
{
  "files": ["manifest.json", "main.js", "styles.css"],
  "output": "/absolute/path/to/plugin",
  "digest": "sha256:df0b6931cf48a5f73323f930b7099694bece2f781d66073e7e0ca48ea99775dd"
}
```

## Manifest Structure

The CLI creates OCI artifacts following ORAS conventions:

```json
{
  "schemaVersion": 2,
  "mediaType": "application/vnd.oci.image.manifest.v1+json",
  "artifactType": "application/vnd.obsidian.plugin.v1+json",
  "config": {
    "mediaType": "application/vnd.oci.image.config.v1+json",
    "digest": "sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
    "size": 2
  },
  "layers": [
    {
      "mediaType": "application/json",
      "digest": "sha256:...",
      "size": 1064,
      "annotations": {
        "org.opencontainers.image.title": "manifest.json"
      }
    },
    {
      "mediaType": "application/javascript",
      "digest": "sha256:...",
      "size": 208695,
      "annotations": {
        "org.opencontainers.image.title": "main.js"
      }
    },
    {
      "mediaType": "text/css",
      "digest": "sha256:...",
      "size": 3810,
      "annotations": {
        "org.opencontainers.image.title": "styles.css"
      }
    }
  ],
  "annotations": {
    "org.opencontainers.image.created": "2026-02-04T20:49:20Z"
  }
}
```

**Key Features:**
- Each file is stored as a separate layer with its filename in annotations
- Config blob is minimal empty JSON (`{}`)
- Custom `artifactType` identifies it as an Obsidian plugin
- Compatible with `oras pull` and `oras push` commands

## Error Handling

### Push Errors

**Missing Files:**
```
Error: manifest.json not found in ./dist
Error: main.js not found in ./dist
```

**Invalid Manifest:**
```
Error: Could not parse manifest.json: Unexpected token
Error: manifest.json missing required "version" field
```

**Authentication:**
```
Error: GitHub token required. Use --token or set GITHUB_TOKEN
Error: Registry auth failed: invalid credentials
```

### Pull Errors

**Invalid Reference:**
```
Error: Repository reference must include tag or digest
```

**Not Found:**
```
Error: Manifest not found: ghcr.io/username/plugin:1.0.0
```

**Missing Annotations:**
```
Error: Layer sha256:... missing required filename annotation
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Publish Plugin

on:
  push:
    tags:
      - "v*"

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Build plugin
        run: |
          npm install
          npm run build

      - name: Push to GHCR
        run: |
          npx obsidian-plugin-ghcr-cli push ./dist ghcr.io/${{ github.repository_owner }}/my-plugin --json
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Compatibility

### ORAS CLI

The artifacts created by this CLI are compatible with ORAS:

```bash
# Pull with ORAS
oras pull ghcr.io/username/my-plugin:1.0.0

# Push with ORAS (alternative)
oras push ghcr.io/username/my-plugin:1.0.0 \
  manifest.json:application/json \
  main.js:application/javascript \
  styles.css:text/css
```

## Development

### Building from Source

```bash
# Clone repository
git clone https://github.com/username/obsidian-ghcr-plugin-manager
cd obsidian-ghcr-plugin-manager/src/cli

# Install dependencies
npm install

# Build
npm run build

# Test
node dist/cli/index.js --help
```

### Project Structure

```
src/cli/
├── adapters/
│   └── node-fetch.ts      # Node.js fetch adapter
├── commands/
│   ├── push.ts            # Push command implementation
│   └── pull.ts            # Pull command implementation
├── lib/
│   ├── auth.ts            # Authentication resolution
│   ├── digest.ts          # Digest calculation
│   ├── logger.ts          # Logging utility
│   └── plugin.ts          # Plugin discovery
├── index.ts               # CLI entry point
├── package.json
├── tsconfig.json
└── README.md
```

## License

Mozilla Public License 2.0 (MPL-2.0)

## Support

For issues and questions:
- GitHub Issues: https://github.com/username/obsidian-ghcr-plugin-manager/issues
- Documentation: https://github.com/username/obsidian-ghcr-plugin-manager
