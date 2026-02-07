# @shard-for-obsidian/ui

Shared UI component library for the Shard ecosystem, providing consistent, theme-aware components across the marketplace and installer plugin.

## Features

- **Obsidian Theme Integration**: Automatically uses Obsidian's CSS variables for seamless theming
- **Svelte 5 Components**: Built with modern Svelte 5 runes mode
- **TypeScript Support**: Full type definitions included
- **Tailwind CSS 4**: Utility-first styling with CSS variable bridge
- **Tree-shakeable**: Import only what you need

## Installation

```bash
pnpm add @shard-for-obsidian/ui
```

## Usage

### Import Styles

Import the styles once in your app's entry point or layout:

```svelte
<script>
  import '@shard-for-obsidian/ui/styles';
</script>
```

### Button Component

Interactive button with multiple variants:

```svelte
<script>
  import { Button } from '@shard-for-obsidian/ui';
</script>

<Button variant="default">Default Button</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>
<Button variant="destructive">Delete</Button>

<!-- With custom classes -->
<Button class="w-full">Full Width Button</Button>

<!-- Disabled state -->
<Button disabled>Disabled</Button>
```

**Props:**

- `variant`: "default" | "secondary" | "outline" | "ghost" | "link" | "destructive" (default: "default")
- `class`: Additional CSS classes
- All standard button HTML attributes

### Card Components

Flexible card container with composable subcomponents:

```svelte
<script>
  import { Card } from '@shard-for-obsidian/ui';
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Card Title</Card.Title>
    <Card.Description>Optional description text</Card.Description>
  </Card.Header>
  <Card.Content>
    Main card content goes here
  </Card.Content>
  <Card.Footer>
    <Button>Action</Button>
  </Card.Footer>
</Card.Root>
```

**Available Components:**

- `Card.Root`: Main container
- `Card.Header`: Header section
- `Card.Title`: Title text
- `Card.Description`: Description text
- `Card.Content`: Content section
- `Card.Footer`: Footer section

All card components accept a `class` prop for custom styling.

### PluginCard Component

Specialized card for displaying marketplace plugins:

```svelte
<script>
  import { PluginCard } from '@shard-for-obsidian/ui';
  import type { MarketplacePlugin } from '@shard-for-obsidian/ui';

  const plugin: MarketplacePlugin = {
    id: 'my-plugin',
    name: 'My Plugin',
    author: 'John Doe',
    description: 'A helpful plugin for Obsidian',
    repo: 'johndoe/my-plugin'
  };
</script>

<PluginCard {plugin} />
```

**Props:**

- `plugin`: MarketplacePlugin object

**MarketplacePlugin Interface:**

```typescript
interface MarketplacePlugin {
  id: string;
  name: string;
  author: string;
  description: string;
  repo: string;
}
```

### SearchBar Component

Search input with icon:

```svelte
<script>
  import { SearchBar } from '@shard-for-obsidian/ui';

  let searchQuery = $state('');
</script>

<SearchBar bind:value={searchQuery} placeholder="Search plugins..." />
```

**Props:**

- `value`: Bound search value (required)
- `placeholder`: Placeholder text
- All standard input HTML attributes

## Obsidian Theme Integration

This package uses Obsidian's CSS variables through a Tailwind CSS bridge, ensuring components automatically match the user's theme:

### Color Variables

```css
--background: var(--background-primary) --foreground: var(--text-normal)
  --card: var(--background-primary-alt)
  --muted: var(--background-modifier-border) --accent: var(--interactive-accent);
```

### Radius Variables

```css
--radius: var(--radius-s) --radius-lg: var(--radius-l);
```

Components will automatically adapt to light/dark themes and custom theme modifications.

## Utilities

### cn() Function

Utility for merging class names with Tailwind:

```svelte
<script>
  import { cn } from '@shard-for-obsidian/ui';

  const buttonClasses = cn(
    'base-class',
    condition && 'conditional-class',
    props.class
  );
</script>
```

## Development

### Prerequisites

- Node.js 18+
- pnpm 8+

### Setup

```bash
# Install dependencies
pnpm install

# Build package
pnpm build

# Watch mode (if configured)
pnpm dev
```

### Project Structure

```
src/
├── components/
│   ├── button/
│   │   └── button.svelte
│   ├── card/
│   │   ├── card.svelte
│   │   ├── card-header.svelte
│   │   ├── card-title.svelte
│   │   ├── card-description.svelte
│   │   ├── card-content.svelte
│   │   ├── card-footer.svelte
│   │   └── index.ts
│   ├── plugin-card/
│   │   └── plugin-card.svelte
│   └── search-bar/
│       └── search-bar.svelte
├── styles/
│   └── index.css
├── types/
│   └── marketplace.ts
├── utils/
│   └── cn.ts
└── index.ts
```

### Building

The package uses Vite for bundling and TypeScript for type generation:

```bash
pnpm build
```

This generates:

- `dist/`: Compiled JavaScript components
- `dist/styles/`: CSS bundle
- `dist/**/*.d.ts`: TypeScript declarations

## License

MIT
