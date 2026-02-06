# Shard Installer Rewrite Design

**Date:** 2026-02-05
**Status:** Approved
**Goal:** Rewrite shard-installer with reusable components and consistent styling

## Overview

Complete rewrite of the shard-installer package to establish:

- Reusable UI component library
- Consistent styling system with design tokens
- Clean separation between primitives and domain components
- Maintainable CSS-based styling (no inline styles)

This is a big-bang rewrite since the plugin is unpublished. Focus on maintainability and good UI/UX.

## Architecture

### Three-Layer Structure

**1. UI Primitives Layer** (`/src/ui/`)

- Core reusable components wrapping Obsidian's declarative API
- Components: Button, Card, IconButton, List, Badge, Divider, EmptyState, ErrorBanner, LoadingSpinner
- Factory functions returning configured DOM elements
- Example: `Button(container, { text: "Install", variant: "primary", onClick: () => {} })`

**2. Feature Layers** (`/src/marketplace/`, `/src/installer/`)

- Domain-specific components, views, and logic
- Structure: `marketplace/components/`, `marketplace/marketplace-view.ts`, `marketplace/marketplace-client.ts`
- Components like PluginCard, MarketplaceHeader, VersionList
- Compose UI primitives with business logic

**3. Shared Layer** (`/src/shared/`)

- Cross-cutting concerns: types, utilities, adapters
- Not feature-specific but used across features

### Styling Organization

Development files (bundled to single `styles.css` for distribution):

- `/styles/tokens.css` - Design tokens (`--shard-*` variables)
- `/styles/primitives.css` - UI primitive component styles
- `/styles/marketplace.css` - Marketplace-specific styles
- `/styles/installer.css` - Installer-specific styles
- `/styles/base.css` - Global resets and base styles

All styles use BEM naming (`.shard-card`, `.shard-card__title`, `.shard-card--highlighted`) and reference design tokens exclusively.

Build process (esbuild) bundles all CSS into single `styles.css` for publication.

## Design Token System

Semantic layer between components and Obsidian's theme variables.

### Token Categories

**Colors** (map to Obsidian variables):

- `--shard-bg-primary` → `var(--background-primary)`
- `--shard-bg-secondary` → `var(--background-secondary)`
- `--shard-bg-elevated` → `var(--background-primary-alt)`
- `--shard-border` → `var(--background-modifier-border)`
- `--shard-text-normal` → `var(--text-normal)`
- `--shard-text-muted` → `var(--text-muted)`
- `--shard-text-accent` → `var(--text-accent)`
- `--shard-text-error` → `var(--text-error)`
- `--shard-interactive-hover` → `var(--background-modifier-hover)`

**Spacing** (consistent scale):

- `--shard-space-xs`: 4px
- `--shard-space-sm`: 8px
- `--shard-space-md`: 12px
- `--shard-space-lg`: 16px
- `--shard-space-xl`: 24px
- `--shard-space-2xl`: 32px

**Typography**:

- `--shard-font-size-sm`: 0.85em
- `--shard-font-size-base`: 1em
- `--shard-font-size-lg`: 1.1em
- `--shard-font-mono` → `var(--font-monospace)`

**Borders & Radius**:

- `--shard-radius-sm`: 4px
- `--shard-radius-md`: 6px
- `--shard-border-width`: 1px

## UI Primitives API

Each primitive is a factory function accepting a parent container and options object.

### Core Primitives

**Button**

```typescript
Button(container: HTMLElement, options: {
  text?: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  ariaLabel?: string;
  disabled?: boolean;
}): HTMLButtonElement
```

**Card**

```typescript
Card(container: HTMLElement, options?: {
  variant?: 'default' | 'elevated' | 'outlined';
  clickable?: boolean;
  onClick?: () => void;
}): HTMLDivElement & {
  header: HTMLDivElement;
  body: HTMLDivElement;
  footer: HTMLDivElement;
}
```

**IconButton**

```typescript
IconButton(container: HTMLElement, options: {
  icon: string;
  ariaLabel: string;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}): HTMLDivElement
```

**State Components**

```typescript
LoadingSpinner(container: HTMLElement, options?: {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
}): HTMLDivElement

ErrorBanner(container: HTMLElement, options: {
  title: string;
  message: string;
  onRetry?: () => void;
}): HTMLDivElement

EmptyState(container: HTMLElement, options: {
  icon?: string;
  message: string;
}): HTMLDivElement
```

**List**

```typescript
List(container: HTMLElement, options?: {
  gap?: 'sm' | 'md' | 'lg';
}): HTMLDivElement
```

Primitives handle CSS class application and return created element for further manipulation.

## Domain Components (Marketplace)

Domain-specific components build on primitives.

**PluginCard**

```typescript
PluginCard(container: HTMLElement, options: {
  plugin: MarketplacePlugin;
  installedInfo?: InstalledPluginInfo;
  onBrowseVersions: (plugin: MarketplacePlugin) => void;
}): HTMLDivElement
```

Internally uses:

- `Card()` for container
- `Button()` for "Browse Versions"
- `Badge()` for installation status
- Custom layout for plugin metadata (name, author, description, repo link, registry URL)

**MarketplaceHeader**

```typescript
MarketplaceHeader(container: HTMLElement, options: {
  onRefresh: () => void;
}): HTMLDivElement
```

Uses standard header layout with title and `IconButton()` for refresh.

**VersionListItem**

```typescript
VersionListItem(container: HTMLElement, options: {
  tag: string;
  isCurrent: boolean;
  actionText: string;
  onSelect: (tag: string) => void;
}): HTMLDivElement
```

Used in version selection modal. Highlights current version, shows action hint.

**Organization:**

- `/src/marketplace/components/plugin-card.ts`
- `/src/marketplace/components/marketplace-header.ts`
- `/src/marketplace/components/version-list-item.ts`

## State Management and Data Flow

### View State Pattern

Each view manages its own state and rendering cycle:

```typescript
class MarketplaceView extends ItemView {
  private state: {
    plugins: MarketplacePlugin[];
    loading: boolean;
    error: string | null;
  };

  private render(): void {
    // Clear container
    // Render based on current state
    // Components are pure - state flows down, events flow up
  }

  private setState(updates: Partial<State>): void {
    this.state = { ...this.state, ...updates };
    this.render();
  }
}
```

### Data Flow

1. **Downward (props)**: Views pass data and callbacks to components
2. **Upward (events)**: Components call callbacks, views update state and re-render
3. **No shared state**: Each component receives everything it needs via parameters

### Error Handling

- **Network errors**: Caught in view layer, displayed via `ErrorBanner()` with retry
- **User actions**: Show `Notice` for immediate feedback (installing, installed, failed)
- **Loading states**: `LoadingSpinner()` for async operations

### Benefits

- Simple mental model: data down, events up
- Components are stateless functions (easy to test)
- Views control all state (easy to debug)
- Re-rendering is explicit and controlled

## Build Process and Testing

### Build Process Changes

Modify `esbuild.config.mjs` to:

1. Bundle all CSS files from `/styles/*.css` into single `dist/styles.css`
2. Maintain existing TypeScript bundling
3. Add CSS minification in production mode

Plugin manifest already references `styles.css` - no changes needed.

### Testing Strategy

UI-heavy rewrite approach:

- **Manual testing**: Primary approach given Obsidian's environment
- **Type safety**: Strict TypeScript to catch errors at compile time
- **Component contracts**: Well-defined interfaces for all components
- **Future**: Can add unit tests for pure functions (semver-utils, formatters)

## Migration Execution Plan

### 1. Foundation (primitives + tokens)

- Create `/src/ui/` folder with all primitive components
- Create `/styles/tokens.css` and `/styles/primitives.css`
- Update build to bundle CSS

### 2. Marketplace feature

- Create `/src/marketplace/components/`
- Rewrite `MarketplaceView` using new components
- Create `/styles/marketplace.css`

### 3. Version selection

- Create version list item component
- Rewrite `VersionSelectionModal` using new components

### 4. Cleanup

- Remove old inline styling code
- Ensure no `setCssProps()` calls remain
- Verify settings view still works (not touched in rewrite)

## File Impact

**Files to Create:** ~15 new files

- 8 primitives
- 3 marketplace components
- 4 CSS files

**Files to Rewrite:** 2 files

- `marketplace-view.ts`
- `version-selection-modal.ts`

**Files Unchanged:**

- Settings
- Clients
- Utilities
- Adapters

## Success Criteria

- Zero inline styles (no `setCssProps()` calls)
- All components use design tokens
- Consistent visual appearance
- Maintainable component structure
- Clean separation of concerns
- Type-safe component APIs
