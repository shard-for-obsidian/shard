<script lang="ts">
  import type { MarketplacePlugin } from '$lib/types';
  import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter
  } from '$lib/components/card';
  import { Button } from '$lib/components/button';

  interface Props {
    plugin: MarketplacePlugin;
    onInstall?: (plugin: MarketplacePlugin) => void;
    class?: string;
  }

  let { plugin, onInstall, class: className }: Props = $props();

  function handleInstall() {
    onInstall?.(plugin);
  }
</script>

<Card class={className}>
  <CardHeader>
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1">
        <CardTitle class="text-lg">{plugin.name}</CardTitle>
        <CardDescription class="mt-1">{plugin.description}</CardDescription>
      </div>
      {#if plugin.icon}
        <div class="text-2xl">{plugin.icon}</div>
      {/if}
    </div>
  </CardHeader>

  <CardContent>
    <div class="flex flex-wrap gap-2 text-sm text-muted-foreground">
      <span>by {plugin.author}</span>
      {#if plugin.version}
        <span>•</span>
        <span>v{plugin.version}</span>
      {/if}
      {#if plugin.downloads}
        <span>•</span>
        <span>{plugin.downloads.toLocaleString()} downloads</span>
      {/if}
    </div>

    {#if plugin.tags && plugin.tags.length > 0}
      <div class="mt-3 flex flex-wrap gap-1.5">
        {#each plugin.tags as tag}
          <span
            class="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
          >
            {tag}
          </span>
        {/each}
      </div>
    {/if}
  </CardContent>

  <CardFooter>
    <Button
      variant="default"
      size="sm"
      class="w-full"
      onclick={handleInstall}
    >
      Install
    </Button>
  </CardFooter>
</Card>
