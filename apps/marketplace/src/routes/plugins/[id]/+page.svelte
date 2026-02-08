<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { base } from "$app/paths";
  import type { MarketplacePlugin } from "$lib/types";

  interface Props {
    data: {
      plugin: MarketplacePlugin;
    };
  }

  let { data }: Props = $props();
  const plugin = $derived(data.plugin);

  const latestVersion = $derived(plugin.versions?.[0]?.tag || "N/A");
  const installCommand = $derived(
    `shard install ${plugin.registryUrl}:${latestVersion}`,
  );

  function copyInstallCommand() {
    navigator.clipboard.writeText(installCommand);
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function formatSize(bytes: number) {
    return (bytes / 1024).toFixed(0) + " KB";
  }
</script>

<svelte:head>
  <title>{plugin.name} - Shard Marketplace</title>
  <meta name="description" content={plugin.description} />
</svelte:head>

<div class="max-w-5xl mx-auto">
  <div class="mb-6">
    <a
      href="{base}/"
      class="text-sm text-muted-foreground hover:text-foreground"
    >
      ← Back to marketplace
    </a>
  </div>

  <div class="grid gap-6 lg:grid-cols-3 relative">
    <!-- Metadata Sidebar -->
    <div class="lg:col-span-1">
      <div class="sticky top-4">
        <Card.Root>
          <Card.Header>
            <Card.Title class="text-lg">Plugin Info</Card.Title>
          </Card.Header>
          <Card.Content class="space-y-4">
            <div>
              <p class="text-xs text-muted-foreground">ID</p>
              <p class="font-mono text-sm">{plugin.id}</p>
            </div>

            <div>
              <p class="text-xs text-muted-foreground">Author</p>
              <p class="text-sm">{plugin.author}</p>
            </div>

            {#if plugin.minObsidianVersion}
              <div>
                <p class="text-xs text-muted-foreground">
                  Min Obsidian Version
                </p>
                <p class="text-sm">{plugin.minObsidianVersion}</p>
              </div>
            {/if}

            {#if plugin.repository}
              <div>
                <p class="text-xs text-muted-foreground">Repository</p>
                <a
                  href={plugin.repository}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm text-primary hover:underline"
                >
                  View on GitHub
                </a>
              </div>
            {/if}

            <div>
              <p class="text-xs text-muted-foreground">Registry URL</p>
              <p class="font-mono text-xs break-all">{plugin.registryUrl}</p>
            </div>
          </Card.Content>
          <Card.Footer>
            <Button class="w-full" onclick={copyInstallCommand}>
              Copy Install Command
            </Button>
          </Card.Footer>
        </Card.Root>
      </div>
    </div>

    <!-- Main Content -->
    <div class="lg:col-span-2 space-y-6">
      <!-- Header -->
      <div>
        <h1 class="text-4xl font-bold mb-2">{plugin.name}</h1>
        <p class="text-lg text-muted-foreground">{plugin.description}</p>
      </div>

      <!-- Introduction -->
      {#if plugin.introduction}
        <Card.Root>
          <Card.Header>
            <Card.Title>About</Card.Title>
          </Card.Header>
          <Card.Content>
            <div class="prose prose-sm max-w-none">
              {@html plugin.introduction.replace(/\n/g, "<br>")}
            </div>
          </Card.Content>
        </Card.Root>
      {/if}

      <!-- Versions -->
      {#if plugin.versions && plugin.versions.length > 0}
        <Card.Root>
          <Card.Header>
            <Card.Title>Available Versions</Card.Title>
            <Card.Description>
              {plugin.versions.length} version{plugin.versions.length !== 1
                ? "s"
                : ""} available
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <div class="space-y-3">
              {#each plugin.versions as version}
                <div class="border rounded-lg p-4">
                  <div class="flex items-start justify-between mb-2">
                    <div>
                      <p class="font-mono font-semibold">{version.tag}</p>
                      <p class="text-xs text-muted-foreground">
                        Published: {formatDate(version.publishedAt)}
                      </p>
                    </div>
                    <div class="text-right">
                      <p class="text-sm text-muted-foreground">
                        {formatSize(version.size)}
                      </p>
                    </div>
                  </div>

                  {#if version.annotations && Object.keys(version.annotations).length > 0}
                    <div class="mt-2 space-y-1">
                      {#each Object.entries(version.annotations) as [key, value]}
                        <p class="text-xs text-muted-foreground">
                          <span class="font-mono">{key}:</span>
                          {value}
                        </p>
                      {/each}
                    </div>
                  {/if}

                  <div class="mt-3">
                    <code class="text-xs bg-muted px-2 py-1 rounded">
                      shard install {plugin.registryUrl}:{version.tag}
                    </code>
                  </div>
                </div>
              {/each}
            </div>
          </Card.Content>
        </Card.Root>
      {/if}
    </div>
  </div>
</div>
