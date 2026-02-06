<script lang="ts">
	import PluginCard from '$lib/components/PluginCard.svelte';
	import type { MarketplacePlugin } from '$lib/types';

	interface Props {
		data: {
			plugins: MarketplacePlugin[];
			generatedAt: string;
		};
	}

	let { data }: Props = $props();
</script>

<div>
	<h2 class="text-3xl font-bold mb-6">Available Plugins</h2>

	{#if data.plugins.length === 0}
		<p class="text-muted-foreground">No plugins available yet.</p>
	{:else}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each data.plugins as plugin}
				<PluginCard {plugin} />
			{/each}
		</div>
	{/if}
</div>
