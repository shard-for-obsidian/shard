<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		data: {
			plugins: any[];
			generatedAt: string;
		};
	}

	let { children, data }: Props = $props();
</script>

<div class="app">
	<header class="border-b">
		<div class="container mx-auto px-4 py-6">
			<h1 class="text-2xl font-bold">Shard Plugin Marketplace</h1>
		</div>
	</header>

	<main class="flex-1 container mx-auto px-4 py-8">
		{@render children()}
	</main>

	<footer class="border-t">
		<div class="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
			<p>Built with SvelteKit</p>
			{#if data.generatedAt}
				<p class="text-xs mt-1">Last updated: {new Date(data.generatedAt).toLocaleDateString()}</p>
			{/if}
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
