<script lang="ts">
  import "../app.css";
  import SearchBar from "$lib/components/SearchBar.svelte";
  import type { Snippet } from "svelte";
  import { asset, resolve } from "$app/paths";
  import { ModeWatcher } from "mode-watcher";
  import ModeToggle from "$lib/components/ModeToggle.svelte";

  interface Props {
    children: Snippet;
    data: {
      plugins: any[];
      generatedAt: string;
    };
  }

  let { children, data }: Props = $props();
</script>

<ModeWatcher />
<div class="app">
  <header class="border-b">
    <div
      class="container mx-auto px-4 py-6 flex items-center justify-between flex-row"
    >
      <div class="flex items-center flex-row gap-4">
        <a href={resolve("/")} class="hover:scale-105 transition-transform">
          <img
            src={asset("/shard-logo.svg")}
            alt="Shard Logo"
            class="h-16 w-auto"
          />
        </a>

        <div class="gap-0">
          <h1 class="text-2xl/4 font-bold">
            <a href={resolve("/")} class="hover:text-primary transition-colors">
              Shard for Obsidian
            </a>
          </h1>
          <small class="text-xs uppercase text-gray-500">Marketplace</small>
        </div>
      </div>
      <div class="flex items-center flex-row gap-4 w-full max-w-md">
        <SearchBar />
      </div>
    </div>
  </header>

  <main class="flex-1 container mx-auto px-4 py-8">
    {@render children()}
  </main>

  <footer class="border-t">
    <div
      class="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground flex flex-row justify-between items-center"
    >
      <div></div>
      <div>
        <p><a href="https://github.com/shard-for-obsidian/shard">GitHub</a></p>
        {#if data.generatedAt}
          <p class="text-xs mt-1">
            Last updated: {new Date(data.generatedAt).toLocaleDateString()}
          </p>
        {/if}
      </div>
      <div>
        <ModeToggle />
      </div>
    </div>
  </footer>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
</style>
