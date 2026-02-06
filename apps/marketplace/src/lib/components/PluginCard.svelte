<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import type { MarketplacePlugin } from '$lib/types';

	interface Props {
		plugin: MarketplacePlugin;
	}

	let { plugin }: Props = $props();

	const latestVersion = $derived(plugin.version || 'N/A');
	const installCommand = $derived(`shard install ${plugin.registryUrl}:${latestVersion}`);

	function copyInstallCommand() {
		navigator.clipboard.writeText(installCommand);
	}
</script>

<Card.Root class="flex flex-col h-full">
	<Card.Header>
		<Card.Title class="text-xl">{plugin.name}</Card.Title>
		<Card.Description>by {plugin.author}</Card.Description>
	</Card.Header>

	<Card.Content class="flex-1">
		<p class="text-sm text-muted-foreground mb-4">{plugin.description}</p>

		<div class="text-xs text-muted-foreground space-y-1">
			<p>Latest: <span class="font-mono">{latestVersion}</span></p>
			{#if plugin.license}
				<p>License: {plugin.license}</p>
			{/if}
		</div>
	</Card.Content>

	<Card.Footer class="flex gap-2">
		<Button
			variant="default"
			class="flex-1"
			onclick={() => (window.location.href = `/shard/plugins/${plugin.id}/`)}
		>
			View Details
		</Button>

		<Button
			variant="outline"
			size="icon"
			onclick={copyInstallCommand}
			title="Copy install command"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
				<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
			</svg>
		</Button>
	</Card.Footer>
</Card.Root>
