<script lang="ts">
	import { page } from '$app/stores';
	import { Button, Card } from '@shard-for-obsidian/ui';
	import { base } from '$app/paths';
</script>

<div class="flex items-center justify-center min-h-[60vh]">
	<Card.Root class="max-w-md">
		<Card.Header>
			<Card.Title class="text-4xl">
				{$page.status}
			</Card.Title>
			<Card.Description>
				{$page.error?.message || 'An error occurred'}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<p class="text-sm text-muted-foreground">
				{#if $page.status === 404}
					The plugin you're looking for doesn't exist or has been removed.
				{:else}
					Something went wrong. Please try again later.
				{/if}
			</p>
		</Card.Content>
		<Card.Footer>
			<Button onclick={() => (window.location.href = `${base}/`)}>
				Back to Marketplace
			</Button>
		</Card.Footer>
	</Card.Root>
</div>
