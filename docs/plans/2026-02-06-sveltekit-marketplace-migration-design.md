# SvelteKit Marketplace Migration Design

**Date**: 2026-02-06
**Status**: Approved

## Overview

Migrate the Shard plugin marketplace from Hugo to SvelteKit to consolidate the technology stack. The migration maintains the current static site generation approach while enabling future evolution toward more dynamic features.

## Goals

1. Replace Hugo with SvelteKit for marketplace site generation
2. Maintain static site deployment to GitHub Pages
3. Keep existing OCI version querying workflow
4. Enable progressive enhancement with search and interactive features
5. Adopt modern component-based development with shadcn-svelte
6. Preserve flexibility for future dynamic capabilities

## Architecture

### High-Level Structure

```
shard/
├── apps/
│   └── marketplace/          # New SvelteKit app
│       ├── src/
│       │   ├── routes/       # SvelteKit pages
│       │   ├── lib/          # Components, utilities
│       │   └── app.html      # HTML shell
│       ├── static/           # Public assets, plugins.json
│       ├── svelte.config.js  # SvelteKit config
│       └── package.json      # Workspace package
├── marketplace/
│   ├── plugins/*.md          # Plugin sources (keep here)
│   ├── scripts/generate-plugins-json.ts  # Keep as-is
│   └── data/plugins.json     # Generated (temp)
└── packages/
    └── shard-installer/src/marketplace/types.ts  # Shared types
```

### Build Flow

1. Script reads `marketplace/plugins/*.md` (flexible: can also read from `apps/marketplace/content/`)
2. Queries OCI registries, generates `plugins.json`
3. Outputs to `apps/marketplace/static/plugins.json`
4. Search index generator creates `search-index.json`
5. SvelteKit build reads static JSON at prerender time
6. `adapter-static` generates static HTML/CSS/JS
7. Deploy to GitHub Pages

**Progressive Design**: This keeps the proven OCI querying logic intact while moving to SvelteKit. Later, the script logic can migrate into Vite plugins or load functions without breaking the workflow.

## Routing & Pages

### Route Structure

```
apps/marketplace/src/routes/
├── +layout.svelte              # Site-wide layout (header, footer)
├── +layout.ts                  # Load plugins.json for all pages
├── +page.svelte                # Home: plugin grid
├── plugins/
│   ├── +page.svelte           # Optional: all plugins list
│   └── [id]/
│       └── +page.svelte       # Individual plugin page
└── +error.svelte              # 404/error page
```

### Data Loading Pattern

```typescript
// src/routes/+layout.ts
export const prerender = true;

export async function load({ fetch }) {
  const res = await fetch("/plugins.json");
  const data: MarketplaceIndex = await res.json();
  return { plugins: data.plugins };
}
```

Since `plugins.json` is in `static/`, it's available at `/plugins.json`. The root layout loads it once, making plugin data available to all pages via `$page.data`.

### URL Structure

- `/` → home page with plugin grid
- `/plugins/shard-installer/` → plugin detail page

Matches current Hugo URL structure for seamless migration.

## UI Components

### Component Architecture

```
apps/marketplace/src/lib/
├── components/
│   ├── ui/                    # shadcn-svelte components
│   │   ├── card/
│   │   ├── button/
│   │   ├── badge/
│   │   └── ...
│   ├── PluginCard.svelte      # Custom: home page plugin card
│   ├── PluginHeader.svelte    # Custom: plugin page header
│   ├── VersionList.svelte     # Custom: version history list
│   ├── InstallCommand.svelte  # Custom: copyable install command
│   ├── SearchBar.svelte       # Search input with dropdown
│   └── SearchResults.svelte   # Results list
├── search/
│   ├── index.ts               # Search client logic
│   └── build-index.ts         # Build-time index generator
├── styles/
│   └── app.css                # Global styles, Tailwind imports
└── types.ts                   # Re-export from shard-installer
```

### shadcn-svelte Setup

- Install: `npx shadcn-svelte@latest init`
- Core components: Card, Button, Badge, Separator, Tabs
- Custom theme variables in `app.css` for Shard branding
- Tailwind configured with brand colors

### Key Custom Components

1. **PluginCard** - Home page grid item with plugin name, author, description, install button
2. **PluginHeader** - Plugin detail page hero with metadata sidebar
3. **VersionList** - Expandable version history with dates, sizes, commit info
4. **InstallCommand** - Code block with copy-to-clipboard for `shard install` commands
5. **SearchBar** - Debounced search input with instant dropdown results
6. **SearchResults** - Results list with keyboard navigation

### Brand Customization

```css
/* app.css - Shard brand theme */
:root {
  --primary: /* brand color */;
  --secondary: /* accent */;
  /* ... other CSS variables */
}
```

## Search Functionality

### Lunr.js Integration

**Build-Time Index Generation**:

- Script reads `plugins.json` and generates lunr search index
- Serialized index saved to `static/search-index.json`
- Indexes: plugin name, author, description, tags

**Client-Side Search**:

```typescript
// src/lib/search/index.ts
import lunr from "lunr";

let searchIndex: lunr.Index | null = null;

export async function initSearch() {
  const res = await fetch("/search-index.json");
  const data = await res.json();
  searchIndex = lunr.Index.load(data);
}

export function search(query: string) {
  return searchIndex?.search(query) || [];
}
```

**SearchBar Component Features**:

- Debounced input
- Instant dropdown results as you type
- Keyboard navigation (arrow keys, enter)
- Links to matching plugin pages

**Progressive Enhancement**:

- Site works without JavaScript (static links)
- Search enhances UX when JS enabled
- Future: add filters (by author, tags, min Obsidian version)

## Build & Deployment

### Local Development

```bash
# Generate plugins.json from markdown + OCI
pnpm marketplace:generate

# Start SvelteKit dev server
pnpm --filter marketplace dev

# Or single command (add to root package.json)
pnpm marketplace:dev  # runs both in sequence
```

### Build Process

```bash
# 1. Generate data
pnpm marketplace:generate
# → Outputs to apps/marketplace/static/plugins.json

# 2. Build search index
pnpm marketplace:build-search
# → Outputs to apps/marketplace/static/search-index.json

# 3. Build SvelteKit site
pnpm --filter marketplace build
# → Uses adapter-static, outputs to apps/marketplace/build/
```

### GitHub Actions Workflow

```yaml
# .github/workflows/marketplace.yml
- name: Setup pnpm
- name: Install dependencies
- name: Generate plugins data
  run: pnpm marketplace:generate
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
- name: Build search index
  run: pnpm marketplace:build-search
- name: Build SvelteKit site
  run: pnpm --filter marketplace build
- name: Deploy to GitHub Pages
  uses: actions/upload-pages-artifact@v3
  with:
    path: apps/marketplace/build
```

### Workspace Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
  - "apps/*"
```

```json
// apps/marketplace/package.json
{
  "name": "marketplace",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

### Content Path Flexibility

Script can read from:

- `../../marketplace/plugins/*.md` (current location)
- `./content/plugins/*.md` (future option)

Config option to switch sources. Enables keeping submissions in repo root while app is isolated.

## Configuration

### SvelteKit Configuration

```javascript
// apps/marketplace/svelte.config.js
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: "build",
      assets: "build",
      fallback: "404.html",
      precompress: false,
      strict: true,
    }),
    paths: {
      base: "/shard", // GitHub Pages subpath
    },
    prerender: {
      entries: ["*"],
      handleHttpError: "warn",
    },
  },
};
```

### Vite Configuration

```javascript
// apps/marketplace/vite.config.ts
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      $types: "../../../packages/shard-installer/src/marketplace/types",
    },
  },
});
```

### Type Sharing

- Import types from `packages/shard-installer/src/marketplace/types.ts`
- No duplication, single source of truth
- Both CLI and marketplace use same interfaces

### Environment Variables

- `GITHUB_TOKEN` - for OCI registry queries (build time only)
- `PUBLIC_BASE_PATH` - for asset paths if needed

## Migration Strategy

### Phase 1: Parallel Development

- Create `apps/marketplace` with SvelteKit
- Keep existing Hugo site in `marketplace/` running
- Both read from same `marketplace/plugins/*.md` sources
- Validate SvelteKit output matches Hugo functionality

### Phase 2: Cutover

- Update GitHub Actions to build SvelteKit instead of Hugo
- Change baseURL in deployment config
- Archive Hugo files (move to `marketplace/archive/`)
- Keep plugin markdown files in place

### Phase 3: Cleanup

- Remove Hugo dependencies
- Update documentation
- Optional: migrate plugin files to `apps/marketplace/content/` if desired

## Benefits

- **Unified Stack**: Single framework (TypeScript/Svelte) across CLI, installer, and marketplace
- **Component Reusability**: Potential to share components between marketplace site and Obsidian plugin UI
- **Better DX**: Hot module reloading, TypeScript throughout, modern tooling
- **Search**: Client-side search with Lunr.js for instant filtering
- **Progressive Design**: Start static, easy path to add dynamic features later
- **Modern UI**: shadcn-svelte provides polished, accessible components with custom branding
- **Type Safety**: Shared types between all packages eliminate duplication

## Future Enhancements

Once migrated, the SvelteKit architecture enables:

- **Advanced Search**: Filters by author, tags, Obsidian version
- **Interactive Install**: Direct install flows from browser (if feasible with Obsidian APIs)
- **Analytics**: Track popular plugins, installation trends
- **Server-Side Rendering**: Move to SvelteKit server for live OCI queries
- **API Endpoints**: Expose marketplace data via JSON endpoints
- **User Features**: Ratings, reviews, plugin collections
