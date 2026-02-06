# Shard Marketplace - SvelteKit

Modern marketplace site for Shard Obsidian plugins, built with SvelteKit.

## Features

- 🎨 **shadcn-svelte UI** - Beautiful, accessible components with custom branding
- 🔍 **Lunr.js Search** - Client-side full-text search across plugins
- ⚡ **Static Site Generation** - Pre-rendered with SvelteKit adapter-static
- 📱 **Responsive Design** - Works on all devices with Tailwind CSS v4
- 🔄 **Dynamic Version Data** - OCI registry queries at build time

## Development

### Prerequisites

- Node.js 20+
- pnpm 10+

### Setup

```bash
# Install dependencies
pnpm install

# Generate plugins data from OCI registries
pnpm marketplace:generate

# Start dev server
pnpm dev
```

Visit http://localhost:5173

### Build

```bash
# Generate data, build search index, and build site
pnpm build

# Preview production build
pnpm preview
```

## Project Structure

```
apps/marketplace/
├── src/
│   ├── routes/              # SvelteKit routes
│   │   ├── +layout.svelte   # Root layout with header/footer
│   │   ├── +layout.ts       # Data loading (plugins.json)
│   │   ├── +page.svelte     # Home page (plugin grid)
│   │   └── plugins/[id]/    # Plugin detail pages
│   ├── lib/
│   │   ├── components/      # Custom and shadcn-svelte components
│   │   ├── search/          # Lunr.js search client
│   │   └── utils.ts         # Utility functions
│   └── app.css              # Global styles and Tailwind
├── static/                  # Static assets
│   ├── plugins.json         # Generated plugin data
│   └── search-index.json    # Generated search index
├── scripts/
│   └── build-search-index.ts # Search index generator
└── svelte.config.js         # SvelteKit configuration
```

## Data Flow

1. **Build Time**: `marketplace/scripts/generate-plugins-json.ts` queries OCI registries and generates `plugins.json`
2. **Build Time**: `scripts/build-search-index.ts` creates Lunr.js search index from plugin data
3. **Build Time**: SvelteKit prerenders all pages using static JSON files
4. **Runtime**: Search runs client-side using pre-built Lunr index

## Deployment

Site deploys automatically to GitHub Pages via `.github/workflows/marketplace-sveltekit.yml` when changes are pushed to main branch.

## Adding shadcn-svelte Components

```bash
# Example: add badge component
npx shadcn-svelte@latest add badge
```

Components are added to `src/lib/components/ui/`.
