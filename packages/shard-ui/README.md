# @shard-for-obsidian/ui

Shared UI component library for Shard marketplace and installer plugin.

## Components

- Button - Interactive button with variants
- Card - Card container with subcomponents (Header, Title, Description, Content, Footer)
- PluginCard - Specialized card for displaying plugin information
- SearchBar - Search input component

## Usage

```svelte
<script>
  import { Button, Card, PluginCard } from '@shard-for-obsidian/ui';
  import '@shard-for-obsidian/ui/styles';
</script>

<Button variant="primary">Click me</Button>

<Card.Root>
  <Card.Header>
    <Card.Title>Title</Card.Title>
  </Card.Header>
  <Card.Content>Content</Card.Content>
</Card.Root>
```

## Development

```bash
pnpm install
pnpm build
```
