<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
</script>

<h2 class="text-3xl font-bold mb-6">Welcome to the Shard Marketplace</h2>

<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
	<Card.Root>
		<Card.Header>
			<Card.Title>Test Plugin</Card.Title>
			<Card.Description>By Test Author</Card.Description>
		</Card.Header>
		<Card.Content>
			<p>This is a test plugin card with shadcn-svelte components.</p>
		</Card.Content>
		<Card.Footer>
			<Button>Install</Button>
		</Card.Footer>
	</Card.Root>
</div>
