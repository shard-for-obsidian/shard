# Settings-Based GHCR Repository Manager & Installer Design

## Overview

A redesign of the GHCR plugin browser that moves repository management and plugin installation entirely into the settings tab. Users maintain a persistent list of repositories, browse available tags with semantic version filtering, and install plugins directly from settings without needing a separate modal.

## User Experience Flow

1. User opens plugin settings tab
2. Adds one or more GHCR repositories using text input + "Add" button
3. Each repository automatically fetches tags in background (session cache)
4. User toggles "Show all tags" per repository to filter semantic versions
5. Selects a tag from dropdown to see smart action button (Install/Update/Downgrade/Reinstall)
6. Clicks action button to install plugin
7. Installation status shows installed tag and digest
8. Can refresh tags manually or they auto-refresh on next settings open
9. Cannot remove repository while plugin is installed

## Architecture

### Settings Tab Components

**GHCRSettingTab** (enhanced from current implementation)
- Repository management section (add/remove repos)
- Token configuration section (existing)
- Repository list renderer with dynamic entries

**RepositoryEntry** (new component concept)
- Self-contained card/row for each repository
- Manages own state: loading, error, tags, selection
- Renders dropdown, checkbox, buttons, status

### Data Model

**GHCRPluginSettings** (expanded interface)
```typescript
interface GHCRPluginSettings {
  githubToken: string;                                    // Secret key ref
  repositories: RepositoryConfig[];                       // Managed repos
  installedPlugins: Record<string, InstalledPluginInfo>; // Install tracking
}

interface RepositoryConfig {
  repoUrl: string;        // "owner/repo" normalized
  showAllTags: boolean;   // Per-repo semver filter
}

interface InstalledPluginInfo {
  tag: string;            // "v1.2.3"
  digest: string;         // "sha256:abc123..."
  installedAt: number;    // Unix timestamp
  pluginId: string;       // "owner.repo"
}
```

**Session Cache** (in-memory, not persisted)
```typescript
Map<string, CachedTagList>

interface CachedTagList {
  tags: string[];         // All fetched tags
  fetchedAt: number;      // Unix timestamp
  error?: string;         // Error if fetch failed
}
```

### Tag Fetching Strategy

**Session-based cache with background refresh:**
- When settings tab opens, fetch tags for all repositories in parallel
- Store results in session cache (Map in memory)
- If cache exists, show cached tags immediately
- Refresh in background, update UI when new tags arrive
- Cache discarded when settings tab closes
- Manual refresh button triggers immediate fetch

**Loading states:**
- First add (no cache): Show loading spinner until tags arrive
- Subsequent opens: Show cached tags immediately, refresh in background
- Force refresh: Show loading indicator during fetch

## Tag Filtering & Dropdown Behavior

### Semantic Version Detection

Regex pattern matches:
- `v1.2.3`, `1.2.3` (standard semver)
- `v2.0.0-beta.1`, `1.0.0-rc2` (pre-release)
- Excludes: `latest`, `main`, `nightly-2024-01-01`, non-semver strings

### Per-Repository Toggle

**"Show all tags" unchecked (default):**
- Dropdown shows only semver tags
- Sorted latest-first (descending): v2.1.0 → v2.0.0 → v1.0.0
- If installed tag is non-semver, pin it at top with special styling

**"Show all tags" checked:**
- Two sections in dropdown:
  - **Semantic Versions** (descending)
  - **Other Tags** (alphabetical)

### Selection Behavior

- On load: Pre-select installed tag if plugin installed
- No installation: Show placeholder "Select a version"
- Changing selection updates action button text immediately

### Empty States

- No semver tags (but has others): "No semantic versions available" + hint to toggle
- No tags at all: "No tags found"
- Loading: Spinner in dropdown area

## Action Button Logic

### Smart Button Text

Button text determined by comparing selected tag with installed tag:

```
IF plugin not installed:
  → "Install"

IF same tag selected as installed:
  → "Reinstall"

IF different tag selected:
  Parse both as semver:
    IF selected > installed:
      → "Update to v{selected}"
    IF selected < installed:
      → "Downgrade to v{selected}"
    IF can't parse (non-semver):
      → "Install v{selected}"
```

### Installation Flow

1. User clicks action button
2. Button disables, text → "Installing..."
3. Fetch manifest for selected tag (with auth token)
4. Extract digest from manifest response
5. Call `Installer.install(repo, tag)`
6. Update `installedPlugins` map with tag, digest, timestamp, pluginId
7. Save settings to persist
8. Update UI: button re-enables with new text, status shows install info
9. Show Notice: "Installed {repo} v{tag}"

### Error Handling

On installation failure:
- Show Notice with error message
- Re-enable button with original text
- Leave existing installation record unchanged
- Installer should clean up partial files

## Error Handling & Edge Cases

### Tag Fetch Failures

When repository fails to fetch tags:
1. Entry highlights in red (error state class)
2. Error message below repo identifier: "Failed to fetch tags: {reason}"
3. Dropdown hidden/replaced with error state
4. Retry button appears
5. Remove button stays enabled
6. Other repositories unaffected

**Common error messages:**
- 401: "Authentication required - check your GitHub token"
- 404: "Repository not found or access denied"
- Network: "Failed to connect to ghcr.io"
- Rate limit: "Rate limited - try again later"

### Remove Button Logic

- Check if repo exists in `installedPlugins` map
- If installed: Disable button, tooltip "Uninstall the plugin before removing"
- If not installed: Enable button, show confirm dialog on click
- Confirm dialog: "Remove {repo} from your repository list?"
- Remove action: Delete from `repositories` array, save settings

### Add Repository Validation

- Reject empty input
- Normalize: strip protocol, validate `owner/repo` pattern
- Check duplicates: "Repository already in your list"
- Accept formats: `owner/repo`, `ghcr.io/owner/repo`, `https://ghcr.io/owner/repo`

## UI Layout & Styling

### Settings Tab Structure

```
┌──────────────────────────────────────────────┐
│ GHCR Tag Browser Settings                    │
├──────────────────────────────────────────────┤
│                                               │
│ Add Repository                                │
│ ┌─────────────────────────────┐  [Add]       │
│ │ owner/repo or ghcr.io/...   │              │
│ └─────────────────────────────┘              │
│                                               │
│ GitHub Token                                  │
│ ┌─────────────────────────────┐              │
│ │ ••••••••••••                │              │
│ └─────────────────────────────┘              │
│                                               │
│ Managed Repositories                          │
│ ┌────────────────────────────────────────┐   │
│ │ (repository entries here)              │   │
│ └────────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

### Repository Entry Layout

**Normal state:**
```
┌─────────────────────────────────────────────────────┐
│ owner/repo                          [↻] [×]        │
│ ┌─────────────────┐  ☐ Show all tags               │
│ │ Select version ▼│                                 │
│ └─────────────────┘                                 │
│ Status: Not installed                               │
│ [Install]                                           │
└─────────────────────────────────────────────────────┘
```

**Installed state:**
```
┌─────────────────────────────────────────────────────┐
│ owner/repo                          [↻] [×]        │
│ ┌─────────────────┐  ☑ Show all tags               │
│ │ v1.2.3        ▼ │                                 │
│ └─────────────────┘                                 │
│ Installed: v1.2.3 (sha256:abc123...)               │
│ [Update to v1.3.0]                                  │
└─────────────────────────────────────────────────────┘
```

**Error state:**
```
┌─────────────────────────────────────────────────────┐
│ owner/repo                          [↻] [×]        │
│ ⚠ Failed to fetch tags: Repository not found       │
│ [Retry]                                             │
└─────────────────────────────────────────────────────┘
```

**Loading state (first add):**
```
┌─────────────────────────────────────────────────────┐
│ owner/repo                          [↻] [×]        │
│ ⟳ Loading tags...                                  │
└─────────────────────────────────────────────────────┘
```

### Styling Details

**Repository entry card:**
- Border: `var(--background-modifier-border)`
- Background: `var(--background-primary)`
- Padding: 16px
- Margin-bottom: 12px
- Border-radius: 4px
- Hover: `var(--background-modifier-hover)`

**Error state:**
- Border color: `var(--text-error)`
- Error text: `var(--text-error)`

**Digest display:**
- Truncate: `sha256:abc123...` (first ~16 chars after prefix)
- Full digest in tooltip on hover
- Monospace font: `var(--font-monospace)`

**Button colors:**
- Install: Default Obsidian button
- Update: `var(--interactive-accent)` accent color
- Downgrade: `var(--text-warning)` or muted
- Reinstall: Default
- Disabled: Obsidian disabled styling

**Status text:**
- Not installed: `var(--text-muted)`
- Installed: Normal text color
- Error: `var(--text-error)`

## Implementation Considerations

### Removing Current Modal

The `TagBrowserModal` class and command registration can be removed entirely. All functionality moves to `GHCRSettingTab`.

### Settings Persistence

- `repositories` array persists across sessions
- `installedPlugins` map persists to track installations
- Cache is session-only (not persisted)
- Token remains in secret storage

### Parallel Tag Fetching

When settings opens with N repositories:
- Create N promises for tag fetching
- Use `Promise.allSettled()` to handle successes and failures
- Update UI as each promise resolves
- Don't block on failures

### Semantic Version Parsing

Use existing library or simple regex:
- Extract major.minor.patch from tag
- Handle `v` prefix
- Support pre-release suffixes (`-beta`, `-rc`)
- Compare using numeric comparison

### Installation State Synchronization

- Check actual plugin directory existence vs. settings record
- Handle manual plugin deletions (show as "not installed" if dir missing)
- Reconcile on settings tab open

## Future Enhancements (Out of Scope)

- Bulk operations (install all, update all)
- Repository groups/categories
- Automatic update notifications
- Plugin dependency resolution
- Import/export repository lists
- Repository search/filter within settings
- Installation history/rollback
