<script lang="ts">
	import '../app.css';
	let { children } = $props();
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
