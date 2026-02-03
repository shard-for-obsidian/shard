# GHCR Tag Browser Plugin Design

## Overview

An Obsidian plugin that allows users to browse available tags for GitHub Container Registry (GHCR) repositories. Users can query repositories via command palette, view tags in a list, and see metadata for selected tags.

## Architecture

### Core Components

**Plugin Main Class** (`main.ts`)
- Registers command palette command
- Manages plugin settings (GitHub token)
- Initializes GHCR client wrapper

**Settings Tab** (`settings.ts`)
- GitHub token configuration (optional, password field)
- Default registry URL (defaults to `ghcr.io`)

**Tag Browser Modal** (`tag-browser-modal.ts`)
- Repository URL input with flexible parsing
- Loading states during API requests
- Tag list display (left pane)
- Tag details display (right pane)
- Inline error messaging

**GHCR Client Wrapper** (`ghcr-wrapper.ts`)
- Constructs `GHCRClient` instances
- Normalizes repository URLs
- Handles authentication
- Transforms API responses to UI-friendly data

**Existing Client** (`lib/client/`)
- Remains unchanged
- Provides `listAllTags()` and `getManifest()` methods

## Data Flow

### Command Execution
1. User invokes "Browse GHCR Tags" from command palette
2. Modal opens with input field focused
3. User enters repository URL
4. Plugin normalizes URL (adds `ghcr.io/` if missing)
5. Modal shows loading spinner
6. GHCR client fetches tags via `listAllTags()`
7. Tags render in list (alphabetically sorted)
8. User clicks a tag
9. Modal fetches manifest via `getManifest()`
10. Metadata displays in details pane (digest, size)

### Error Handling
- URL parsing fails → "Invalid repository URL" inline
- Network error → "Failed to connect to registry" with details
- Auth fails (401) → "Authentication required - check token"
- Not found (404) → "Repository not found or access denied"
- Rate limiting → "Rate limited. Try again later."

All errors display inline within the modal, replacing content areas.

## UI Components

### Tag Browser Modal

**Layout**: Two-pane split view

**Header Section:**
- Text input: "Enter repository (e.g., owner/repo or ghcr.io/owner/repo)"
- "Fetch Tags" button (or Enter key triggers fetch)
- Optional: GitHub token override field (collapsed, "Use different token" toggle)

**Left Pane (40% width):**
- Scrollable tag list
- Selected tag highlighted
- States:
  - Empty: "No tags loaded"
  - Loading: Spinner + "Fetching tags..."
  - Error: Red error message
  - Success: List of clickable tags

**Right Pane (60% width):**
- Header: "Tag: {tagName}"
- Fields:
  - **Digest**: `sha256:...` (monospace, truncated with tooltip)
  - **Size**: Formatted (e.g., "24.5 MB")
- States:
  - Empty: "Select a tag to view details"
  - Loading: Spinner
  - Error: Error message

Uses Obsidian's standard styling for consistency.

## Implementation Details

### File Structure
```
src/
├── main.ts                 # Plugin entry point
├── settings.ts             # Settings tab
├── tag-browser-modal.ts    # Modal UI
├── ghcr-wrapper.ts         # Client wrapper
└── types.ts                # TypeScript interfaces
lib/
└── client/                 # Existing GHCR client
```

### Key Classes

**GHCRTagBrowserPlugin**
- `onload()` - Load settings, register command
- `openTagBrowser()` - Create and open modal
- `loadSettings()` / `saveSettings()` - Persist configuration

**GHCRPluginSettings**
- `githubToken: string` - Optional GitHub token

**TagBrowserModal**
- `onOpen()` - Build UI, attach event listeners
- `fetchTags(repoUrl: string)` - Trigger tag fetch
- `selectTag(tag: string)` - Load tag details
- `renderTagList(tags: string[])` - Update left pane
- `renderTagDetails(metadata: TagMetadata)` - Update right pane
- `showError(message: string)` - Display inline errors

**GHCRWrapper**
- `normalizeRepoUrl(input: string)` - Parse flexible URLs
- `createClient(repo: string, token?: string)` - Instantiate client
- `getTags(repo: string, token?: string)` - Fetch tag list
- `getTagMetadata(repo: string, tag: string, token?: string)` - Fetch metadata

## Technical Considerations

### Obsidian API Integration
- `Plugin` - Base class
- `Modal` - Tag browser UI
- `PluginSettingTab` - Settings interface
- `Notice` - Optional success feedback
- `requestUrl` - HTTP client (abstracted in wrapper)

### URL Normalization
Supported input formats:
- `ghcr.io/owner/repo` → use as-is
- `owner/repo` → prepend `ghcr.io/`
- `https://ghcr.io/owner/repo` → strip protocol
- `ghcr.io/owner/repo:tag` → parse repo, default to tag

Uses existing `parseRepoAndRef()` after normalization.

### Metadata Extraction
From manifest response:
- **Digest**: `resp.headers['docker-content-digest']` or calculate via `digestFromManifestStr()`
- **Size**: Sum of `manifest.layers[].size`
- **Created**: Skipped in v1 (requires additional blob fetch)

### Error Handling

**URL Validation:**
- Reject empty input
- Validate format: `ghcr.io/owner/repo` pattern
- Clear message: "Invalid repository format. Expected: owner/repo or ghcr.io/owner/repo"

**API Error Scenarios:**
| Error | Message |
|-------|---------|
| 401 Unauthorized | "Authentication failed. Check your GitHub token in settings." |
| 404 Not Found | "Repository not found: {repo}" |
| Network error | "Failed to connect to ghcr.io. Check your connection." |
| Invalid manifest | "Invalid manifest data received for tag {tag}" |
| Rate limiting | "Rate limited by registry. Try again later." |

**Empty States:**
- No tags → "No tags found for this repository"
- Manifest fetch fails → Show error in details pane, keep tag list visible

**Loading States:**
- Spinner during tag fetch
- Spinner in details pane during manifest fetch
- Disable "Fetch Tags" button while loading

**Token Security:**
- Settings stored via Obsidian data storage (encrypted)
- Override token ephemeral (not saved)
- Never log tokens

## Future Enhancements (Out of Scope for v1)
- Tag filtering/search
- Multiple registry support (not just GHCR)
- Insert tag reference into note
- Creation date in metadata (requires config blob fetch)
- Tag comparison view
- Cached tag lists
